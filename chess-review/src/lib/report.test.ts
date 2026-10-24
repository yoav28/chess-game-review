import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { buildReview, parsePgn as parseReview, type GameReview } from './review'
import { parsePgn } from './game'
import { plainTextReport, reviewedPgn, skillSummaries } from './report'
import { terminalEvaluation } from '../engine/protocol'
import type { PositionAnalysis } from '../engine/types'

function fixture(pgn: string): GameReview {
  const game = parseReview(pgn)
  const positions = [game.initialFen, ...game.moves.map(move => move.afterFen)].map((fen, index): PositionAnalysis => ({
    fen, evaluation: terminalEvaluation(new Chess(fen)) ?? { cp: 0, mate: null },
    bestMove: game.moves[index]?.uci ?? null, bestMoveSan: game.moves[index]?.san ?? null,
    pv: [], pvSan: [], depth: 16, lines: [],
  }))
  return buildReview(game, positions)
}

test('skill categories use eligible moves, show both sample sizes, and leave missing data unavailable', () => {
  const review = fixture('1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+ 4. Be2 Nc6 *')
  review.moves[2].accuracy = 55
  review.moves[3].accuracy = 70
  review.moves[5].accuracy = 90
  review.moves[6] = { ...review.moves[6], phase: 'middlegame', accuracy: 62.5 }
  review.moves[7] = { ...review.moves[7], phase: 'middlegame', accuracy: 45 }
  const summaries = skillSummaries(review)
  const categories = Object.fromEntries(summaries.categories.map(category => [category.key, category]))
  assert.deepEqual(categories.tactics.white, { accuracy: 55, moves: 1 })
  assert.deepEqual(categories.tactics.black, { accuracy: 80, moves: 2 })
  assert.deepEqual(categories.strategy.white, { accuracy: 62.5, moves: 1 })
  assert.deepEqual(categories.strategy.black, { accuracy: 45, moves: 1 })
  assert.deepEqual(categories.endgame.white, { accuracy: null, moves: 0 })
  assert.deepEqual(categories.endgame.black, { accuracy: null, moves: 0 })
  assert.equal(categories.opening.white.moves, 3)
  assert.match(summaries.method, /Categories can overlap/)
  assert.match(summaries.method, /not a player rating/)
})

test('a checking promotion counts once in tactics and can overlap the endgame sample', () => {
  const review = fixture('[SetUp "1"]\n[FEN "8/8/8/8/8/8/1p6/4K2k b - - 0 42"]\n\n42... b1=Q+ 43. Kf2 *')
  const categories = skillSummaries(review).categories
  assert.equal(categories.find(category => category.key === 'tactics')?.black.moves, 1)
  assert.equal(categories.find(category => category.key === 'endgame')?.black.moves, 1)
  assert.equal(categories.find(category => category.key === 'opening')?.black.accuracy, null)
})

test('reviewed PGN retains legal moves, headers, result and source clocks while adding scored annotations', () => {
  const original = '[Event "Clock test"]\n[White "Ada"]\n[Black "Grace"]\n[Result "*"]\n\n1.Nf3 {A useful move. [%clk 0:05:00.5] [%eval 8.88]} (1. e4 {[%clk 0:00:01]} e5) 1...Nf6 {[%clk 0:04:59]}\n2. Ng1 $2 {[%clk 0:04:57]} Ng8 {[%clk 0:04:56]}\n3. Nf3 {[%clk 0:04:55]} *'
  const review = fixture(original)
  const annotated = reviewedPgn(review)
  const parsed = parsePgn(annotated)
  assert.deepEqual(parsed.moves.map(move => move.uci), parsePgn(original).moves.map(move => move.uci))
  assert.deepEqual(parsed.clocks, [300.5, 299, 297, 296, 295])
  assert.equal(parsed.headers.Event, 'Clock test')
  assert.equal(parsed.headers.White, 'Ada')
  assert.equal(parsed.headers.Result, '*')
  assert.match(annotated, /A useful move/)
  assert.match(annotated, /\[%eval 0\.00\]/)
  assert.doesNotMatch(annotated, /8\.88/)
  assert.match(annotated, /Best move: Nf3/)
  assert.match(annotated, /depth 16/)
})

test('reviewed PGN preserves custom black-to-move setup and exact fractional clock values', () => {
  const pgn = '[SetUp "1"]\n[FEN "8/8/8/8/8/8/1p6/4K2k b - - 0 42"]\n[Result "0-1"]\n\n42... b1=Q+ {[%clk 0:01:02.5]} 43. Kf2 0-1'
  const review = fixture(pgn)
  const annotated = reviewedPgn(review)
  const parsed = parsePgn(annotated)
  assert.equal(parsed.initialFen, review.initialFen)
  assert.equal(parsed.headers.SetUp, '1')
  assert.equal(parsed.headers.Result, '0-1')
  assert.match(annotated, /42\. \.\.\. b1=Q\+/)
  assert.deepEqual(parsed.clocks, [62.5, null])
  assert.equal(parsed.moves[0].promotion, 'q')
})

test('exported terminal mate uses the winning side even if the report result was unspecified', () => {
  const review = fixture('1. f3 e5 2. g4 Qh4# 0-1')
  review.result = '*'
  const annotated = reviewedPgn(review)
  const parsed = parsePgn(annotated)
  assert.equal(parsed.result, '0-1')
  assert.match(annotated, /\[%eval #-0\]/)
  assert.match(annotated, /0-1$/)
  assert.match(plainTextReport(review), /Result: 0-1/)
})

test('plain text sharing includes category sample counts and independent scoring methods', () => {
  const review = fixture('[White "Ada"]\n[Black "Grace"]\n\n1. e4 e5 *')
  const text = plainTextReport(review)
  assert.match(text, /Ada vs Grace/)
  assert.match(text, /Opening: White 100\.0% \(1 move\); Black 100\.0% \(1 move\)/)
  assert.match(text, /Tactics: White unavailable \(0 moves\); Black unavailable \(0 moves\)/)
  assert.match(text, /No moves exceeded the key-moment threshold/)
  assert.match(text, /Independent metric/)
})

test('export rejects an inconsistent review rather than emitting misleading chess positions', () => {
  const review = fixture('1. e4 e5 *')
  review.moves[1].beforeFen = review.initialFen
  assert.throws(() => reviewedPgn(review), /inconsistent move sequence/)
})
