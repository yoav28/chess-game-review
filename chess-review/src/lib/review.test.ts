import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReview, classifyMove, gamePhase, moveAccuracy, parsePgn } from './review'
import type { PositionAnalysis } from '../engine/types'
import { Chess } from 'chess.js'
import { openingForMoves } from './openings'
import { isSoundSacrifice, isUniqueOpportunity } from './review-metrics'

function position(fen: string, cp: number, bestMove: string | null = null, bestMoveSan: string | null = null): PositionAnalysis {
  return { fen, evaluation: { cp, mate: null }, bestMove, bestMoveSan, pv: [], pvSan: [], depth: 12, lines: [] }
}

test('game review records actual positions and moves from PGN', () => {
  const parsed = parsePgn('[White "Ada"]\n[Black "Grace"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 *')
  assert.equal(parsed.moves.length, 3)
  assert.equal(parsed.moves[0].uci, 'e2e4')
  assert.equal(parsed.moves[0].afterFen, parsed.moves[1].beforeFen)
  assert.equal(parsed.moves[2].color, 'w')
  assert.equal(parsed.headers.White, 'Ada')
})

test('classifications account for mover color and do not penalize the best move for depth noise', () => {
  const game = parsePgn('1. e4 e5 *')
  const black = { ...game.moves[1], bookName: undefined }
  const before = position(black.beforeFen, -50, 'c7c5', 'c5')
  const after = position(black.afterFen, 300)
  assert.deepEqual(classifyMove(black, before, after), { classification: 'blunder', centipawnLoss: 350 })
  assert.deepEqual(classifyMove(black, { ...before, bestMove: 'e7e5' }, after), { classification: 'best', centipawnLoss: 0 })
})

test('a missed winning opportunity and an only legal move have distinct labels', () => {
  const move = { ...parsePgn('1. e4 *').moves[0], bookName: undefined }
  const before = position(move.beforeFen, 250, 'd2d4', 'd4')
  const after = position(move.afterFen, 0)
  assert.equal(classifyMove(move, before, after).classification, 'missed')
  assert.deepEqual(classifyMove({ ...move, legalMoves: 1 }, before, after), { classification: 'forced', centipawnLoss: 0 })
})

test('accuracy decreases with loss and stays within a defined range', () => {
  assert.equal(moveAccuracy(0), 100)
  assert.equal(moveAccuracy(-80), 100)
  assert.ok(moveAccuracy(100) > moveAccuracy(300))
  assert.ok(moveAccuracy(2000) >= 0)
})

test('giving up a forced mate is a missed opportunity even while retaining a material advantage', () => {
  const move = { ...parsePgn('1. a3 *').moves[0], bookName: undefined }
  const before = { ...position(move.beforeFen, 99997, 'd2d4', 'd4'), evaluation: { cp: 99997, mate: 3 } }
  const after = position(move.afterFen, 500)
  assert.equal(classifyMove(move, before, after).classification, 'missed')
  const losesMateForBlack = { ...move, color: 'b' as const }
  assert.equal(classifyMove(losesMateForBlack, { ...before, evaluation: { cp: -99997, mate: -3 } }, position(move.afterFen, -500)).classification, 'missed')
})

test('summary, key moments and coaching are derived from scored moves', () => {
  const parsed = parsePgn('[White "Ada"]\n[Black "Grace"]\n\n1. a3 a6 *')
  const scores = [position(parsed.initialFen, 0, 'a2a3', 'a3'), position(parsed.moves[0].afterFen, 0, 'c7c5', 'c5'), position(parsed.moves[1].afterFen, 350)]
  const review = buildReview(parsed, scores)
  assert.equal(review.whiteAccuracy, 100)
  assert.ok((review.blackAccuracy ?? 100) < 50)
  assert.deepEqual(review.keyMoments, [2])
  assert.equal(review.counts.b.blunder, 1)
  assert.match(review.moves[1].explanation, /c5 was the engine's first choice/)
  assert.match(review.moves[1].explanation, /White has a winning advantage/)
  assert.throws(() => buildReview(parsed, scores.slice(1)), /incomplete/)
})

test('book classification requires an exact registered prefix and does not invent an opening name', () => {
  assert.equal(openingForMoves(['e4']).opening?.name, 'King’s Pawn Game')
  assert.equal(openingForMoves(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']).opening?.name, 'Italian Game')
  assert.equal(openingForMoves(['e4', 'a6']).book, false)
  assert.equal(parsePgn('1. e4 e5 2. Qh5 *').moves[2].bookName, undefined)
})

test('great requires a second scored deep candidate that fails to preserve the position', () => {
  const move = { ...parsePgn('1. e4 *').moves[0], bookName: undefined }
  const best = position(move.beforeFen, 225, move.uci, move.san)
  best.lines = [{ rank: 2, depth: 12, evaluation: { cp: 40, mate: null }, pv: ['d2d4'], pvSan: ['d4'] }]
  assert.equal(isUniqueOpportunity(move, best), true)
  assert.equal(classifyMove(move, best, position(move.afterFen, 220)).classification, 'great')
  assert.equal(isUniqueOpportunity(move, { ...best, lines: [] }), false)
  assert.equal(isUniqueOpportunity(move, { ...best, depth: 8 }), false)
})

test('brilliant heuristic requires a best reply that accepts a real material sacrifice and favorable compensation', () => {
  const fen = 'rnbq1rk1/ppp1bppp/3p1n2/8/3P4/3B1N2/PPP2PPP/RNBQ1RK1 w - - 0 1'
  const board = new Chess(fen)
  board.move('Bxh7+')
  const move = parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. Bxh7+ *`).moves[0]
  const before = position(fen, 180, 'd3h7', 'Bxh7+')
  const after = { ...position(board.fen(), 180, 'g8h7', 'Kxh7'), pv: ['g8h7', 'f3g5'], pvSan: ['Kxh7', 'Ng5+'] }
  assert.equal(isSoundSacrifice(move, before, after), true)
  assert.equal(classifyMove(move, before, after).classification, 'brilliant')
  assert.equal(isSoundSacrifice(move, before, { ...after, evaluation: { cp: -400, mate: null } }), false)
  assert.equal(isSoundSacrifice(move, before, { ...after, pv: ['g8h8'] }), false)
})

test('endgame detection follows material rather than move number alone', () => {
  assert.equal(gamePhase('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1', 3), 'endgame')
  const game = parsePgn('1. e4 e5 *')
  assert.equal(gamePhase(game.initialFen, 1), 'opening')
  assert.equal(gamePhase(game.initialFen, 25), 'middlegame')
})
