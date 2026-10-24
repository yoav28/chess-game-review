import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { analyzeThreat, threatPosition, verifiedThreat, type ThreatPosition } from './threat-analysis'
import { createPosition } from './position'
import type { PositionAnalysis } from '../engine/types'

function position(fen = new Chess().fen(), variant?: 'chess' | 'chess960') {
  const value = threatPosition(fen, variant)
  assert.equal(value.eligible, true)
  return value as Extract<ThreatPosition, { eligible: true }>
}
function analysis(target: ReturnType<typeof position>, pv: string[]): PositionAnalysis {
  return { fen: target.hypotheticalFen, variant: target.variant, evaluation: { cp: -50, mate: null }, bestMove: pv[0] ?? null, bestMoveSan: 'untrusted', pv, pvSan: ['untrusted'], depth: 12, lines: [] }
}

test('a hypothetical pass flips the side and clears en passant while retaining the actual board and castling rights', () => {
  const fen = new Chess().fen()
  const target = position(fen)
  const original = fen.split(' ')
  const changed = target.hypotheticalFen.split(' ')
  assert.equal(target.sourceFen, fen)
  assert.equal(target.color, 'b')
  assert.equal(changed[0], original[0])
  assert.equal(changed[1], 'b')
  assert.deepEqual(changed.slice(2), ['KQkq', '-', '0', '1'])
  const ep = position('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2')
  assert.equal(ep.sourceFen.split(' ')[3], 'd6')
  assert.equal(ep.hypotheticalFen.split(' ')[3], '-')
  assert.equal(createPosition(ep.hypotheticalFen).moves().includes('dxe6'), false)
})

test('in-check, checkmate, stalemate, insufficient-material and fifty-move positions are unavailable', () => {
  const cases = [
    ['4k3/8/8/8/8/8/4r3/4K3 w - - 0 1', /in check/],
    ['7k/6Q1/5K2/8/8/8/8/8 b - - 0 1', /ended/],
    ['7k/5K2/6Q1/8/8/8/8/8 b - - 0 1', /ended/],
    ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', /ended/],
    ['4k3/8/8/8/8/8/4P3/4K3 w - - 100 1', /ended/],
    ['invalid', /valid position/],
  ] as const
  for (const [fen, message] of cases) {
    const result = threatPosition(fen)
    assert.equal(result.eligible, false)
    assert.match(result.reason, message)
  }
})

test('endgames can be analyzed and only locally legal PV moves become SAN and an arrow', () => {
  const target = position('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1')
  const result = verifiedThreat(target, analysis(target, ['e5e4', 'e2e3']))
  assert.deepEqual(result.pvSan, ['Ke4', 'e3'])
  assert.deepEqual(result.arrow, { from: 'e5', to: 'e4' })
  assert.equal(result.firstMove?.san, 'Ke4')
  assert.equal(result.sourceFen, target.sourceFen)
  assert.equal(result.hypotheticalFen, target.hypotheticalFen)
})

test('pinned opponent pieces cannot produce a fabricated threat', () => {
  const target = position('4k3/4n3/8/8/8/8/8/K3R3 w - - 0 1')
  assert.throws(() => verifiedThreat(target, analysis(target, ['e7c8'])), /legal hypothetical/)
  const result = verifiedThreat(target, analysis(target, ['e8f8']))
  assert.equal(result.firstMove?.san, 'Kf8')
})

test('empty PV produces no threat even if a best-move field exists and illegal tails stop at the legal prefix', () => {
  const target = position()
  const empty = verifiedThreat(target, { ...analysis(target, []), bestMove: 'e7e5' })
  assert.equal(empty.firstMove, null)
  assert.equal(empty.arrow, null)
  assert.deepEqual(empty.pvSan, [])
  assert.deepEqual(verifiedThreat(target, analysis(target, ['e7e5', 'e2e4', 'a8a1'])).pvSan, ['e5', 'e4'])
  assert.throws(() => verifiedThreat(target, { ...analysis(target, ['e7e5']), bestMove: 'd7d5' }), /inconsistent/)
})

test('Chess960 retains variant and rook rights while drawing the physical king or stationary-king rook destination', () => {
  const target = position('4k2r/8/8/8/8/8/8/K7 w h - 0 1', 'chess960')
  const result = verifiedThreat(target, analysis(target, ['e8h8']))
  assert.equal(result.variant, 'chess960')
  assert.equal(result.firstMove?.san, 'O-O')
  assert.equal(result.firstMove?.uci, 'e8h8')
  assert.deepEqual(result.arrow, { from: 'e8', to: 'g8' })
  const stationary = position('6kr/8/8/8/8/8/8/K7 w h - 0 1', 'chess960')
  assert.deepEqual(verifiedThreat(stationary, analysis(stationary, ['g8h8'])).arrow, { from: 'h8', to: 'f8' })
})

test('engine position, variant, depth and evaluation mismatches are rejected', () => {
  const target = position()
  assert.throws(() => verifiedThreat(target, { ...analysis(target, ['e7e5']), fen: target.sourceFen }), /different position/)
  assert.throws(() => verifiedThreat(target, { ...analysis(target, ['e7e5']), variant: 'chess960' }), /different.*variant/)
  assert.throws(() => verifiedThreat(target, { ...analysis(target, ['e7e5']), depth: NaN }), /incomplete/)
  assert.throws(() => verifiedThreat(target, { ...analysis(target, ['e7e5']), evaluation: { cp: NaN, mate: null } }), /incomplete/)
})

test('analysis uses the null position, separate one-line budget and no actual-game history', async () => {
  const fen = new Chess().fen()
  const target = position(fen)
  const result = await analyzeThreat(fen, { depth: 15, timeMs: 750, history: { initialFen: fen, moves: [] } }, async (selected, options) => {
    assert.equal(selected, target.hypotheticalFen)
    assert.equal(options?.depth, 15)
    assert.equal(options?.timeMs, 750)
    assert.equal(options?.multiPv, 1)
    assert.equal(options?.variant, 'chess')
    assert.equal(options?.history, undefined)
    return analysis(target, ['e7e5'])
  })
  assert.equal(result.firstMove?.san, 'e5')
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(analyzeThreat(fen, { signal: controller.signal }), { name: 'AbortError' })
})
