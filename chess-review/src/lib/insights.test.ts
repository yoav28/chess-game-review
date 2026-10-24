import assert from 'node:assert/strict'
import test from 'node:test'
import { insightsForMove } from './insights'
import { explainMove, parsePgn, type ParsedMove } from './review'
import type { PositionAnalysis } from '../engine/types'

function lastMove(pgn: string): ParsedMove {
  return parsePgn(pgn).moves.at(-1)!
}

function fromPosition(fen: string, san: string): ParsedMove {
  return lastMove(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. ${san} *`)
}

test('early Nf3 explains minor-piece development and new central control', () => {
  const insights = insightsForMove(lastMove('1. Nf3 *'))
  assert.equal(insights.length, 2)
  assert.match(insights[0], /knight develops from the back rank/)
  assert.match(insights[1], /control of d4 and e5 in the center/)
})

test('rook file insights distinguish open and semi-open files from pawn occupancy', () => {
  const open = fromPosition('4k3/pp3ppp/8/8/8/8/PPP2PPP/R3K3 w Q - 0 1', 'Rd1')
  const semiOpen = fromPosition('4k3/pp1p1ppp/8/8/8/8/PPP2PPP/R3K3 w Q - 0 1', 'Rd1')
  assert.match(insightsForMove(open).join(' '), /open d-file, which has no pawns/)
  assert.match(insightsForMove(semiOpen).join(' '), /semi-open d-file, which has no friendly pawn/)
  const closed = fromPosition('4k3/pp1p1ppp/8/8/8/8/PPPP1PPP/R3K3 w Q - 0 1', 'Rd1')
  assert.doesNotMatch(insightsForMove(closed).join(' '), /open d-file/)
})

test('a moved knight attacking a queen and rook creates factual fork pressure', () => {
  const move = fromPosition('k7/3q3r/8/3N4/8/8/8/4K3 w - - 0 1', 'Nf6')
  const text = insightsForMove(move).join(' ')
  assert.match(text, /attacks the queen on d7 and the rook on h7, creating fork pressure/)
  assert.doesNotMatch(text, /wins material|winning fork/)
})

test('one valuable attacked piece is not falsely called a fork', () => {
  const move = fromPosition('k6r/3q4/8/3N4/8/8/8/4K3 w - - 0 1', 'Nf6')
  assert.doesNotMatch(insightsForMove(move).join(' '), /fork pressure/)
})

test('a pinned knight’s geometric attacks are not presented as a usable fork', () => {
  const move = fromPosition('k4r2/8/8/8/3q3r/8/3N4/5K2 w - - 0 1', 'Nf3')
  assert.doesNotMatch(insightsForMove(move).join(' '), /fork pressure/)
})

test('passed pawn insight requires no opposing pawn ahead on its or an adjacent file', () => {
  const passed = fromPosition('7k/8/8/4P3/8/8/8/4K3 w - - 0 1', 'e6')
  const blocked = fromPosition('7k/3p4/8/4P3/8/8/8/4K3 w - - 0 1', 'e6')
  assert.match(insightsForMove(passed).join(' '), /pawn on e6 is passed/)
  assert.doesNotMatch(insightsForMove(blocked).join(' '), /is passed/)
})

test('Black passed-pawn detection looks toward lower ranks', () => {
  const passed = lastMove('[SetUp "1"]\n[FEN "4k3/8/8/8/4p3/8/8/7K b - - 0 1"]\n\n1... e3 *')
  const blocked = lastMove('[SetUp "1"]\n[FEN "4k3/8/8/8/4p3/8/3P4/7K b - - 0 1"]\n\n1... e3 *')
  assert.match(insightsForMove(passed).join(' '), /pawn on e3 is passed/)
  assert.doesNotMatch(insightsForMove(blocked).join(' '), /is passed/)
})

test('a newly pinned piece must be the sole blocker between the moved slider and king', () => {
  const pin = fromPosition('4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', 'Bb5')
  const blocked = fromPosition('4k3/3p4/2n5/8/8/8/8/4KB2 w - - 0 1', 'Bb5')
  assert.match(insightsForMove(pin).join(' '), /bishop pins the knight on c6 to the king/)
  assert.doesNotMatch(insightsForMove(blocked).join(' '), /pins/)
})

test('an already existing pin is not presented as a new pin after moving along the diagonal', () => {
  const move = fromPosition('4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1', 'Ba4')
  assert.doesNotMatch(insightsForMove(move).join(' '), /pins/)
})

test('hanging-piece coaching requires a legal capture and does not treat a pinned attacker as legal', () => {
  const hanging = fromPosition('4k3/8/5n2/8/8/8/8/3QK3 w - - 0 1', 'Qh5+')
  const pinnedAttacker = fromPosition('5k2/8/5n2/8/8/8/8/3QKR2 w - - 0 1', 'Qh5')
  assert.match(insightsForMove(hanging).join(' '), /queen on h5 can be captured and has no direct defender/)
  assert.doesNotMatch(insightsForMove(pinnedAttacker).join(' '), /can be captured/)
})

test('checkmate uses its direct explanation without irrelevant conceptual claims', () => {
  const move = lastMove('1. f3 e5 2. g4 Qh4# 0-1')
  assert.deepEqual(insightsForMove(move), [])
})

test('move explanation puts conceptual facts before the engine judgment and stays concise', () => {
  const move = lastMove('1. Nf3 *')
  const position = (fen: string): PositionAnalysis => ({
    fen, evaluation: { cp: 0, mate: null }, bestMove: 'g1f3', bestMoveSan: 'Nf3',
    pv: ['g1f3'], pvSan: ['Nf3'], depth: 16, lines: [],
  })
  const explanation = explainMove(move, 'good', position(move.beforeFen), position(move.afterFen))
  assert.ok(explanation.indexOf('develops from the back rank') < explanation.indexOf('gives up a small amount'))
  assert.ok(explanation.length <= 720)
  assert.doesNotMatch(explanation, /excellent development|good control|safe/)
})
