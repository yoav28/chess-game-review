import assert from 'node:assert/strict'
import test from 'node:test'
import { terminalEvaluation } from '../engine/protocol'
import type { PositionAnalysis } from '../engine/types'
import { createPosition, positionMoveUci } from './position'
import { buildReview, parsePgn, type GameReview } from './review'
import { maxReviewTransferBytes, parseReviewTransfer, reviewTransferFilename, serializeReviewTransfer } from './review-transfer'

function fixture(pgn = '[White "Ada"]\n[Black "Grace"]\n\n1. e4 e5 2. Nf3 Nc6 *'): GameReview {
  const game = parsePgn(pgn)
  const positions = [game.initialFen, ...game.moves.map(move => move.afterFen)].map((fen, index): PositionAnalysis => {
    const board = createPosition(fen, game.variant)
    const terminal = terminalEvaluation(board)
    const next = terminal ? undefined : game.moves[index]?.uci ?? positionMoveUci(board.moves({ verbose: true })[0])
    const san = next ? board.move({ from: next.slice(0, 2), to: next.slice(2, 4), promotion: next[4] }).san : null
    const evaluation = terminal ?? { cp: 0, mate: null }
    const pv = next ? [next] : []
    const pvSan = san ? [san] : []
    return { variant: game.variant, fen, evaluation, bestMove: next ?? null, bestMoveSan: san, pv, pvSan, depth: terminal ? 0 : 16,
      lines: terminal ? [] : [{ rank: 1, depth: 16, evaluation, pv, pvSan }] }
  })
  return buildReview(game, positions)
}

function mutate(change: (review: GameReview) => void): string {
  const review = fixture()
  change(review)
  return JSON.stringify({ format: 'open-file-review', formatVersion: 1, exportedAt: new Date().toISOString(), review })
}

test('complete standard report round trips scores, legal lines, metadata, and clocks without engine analysis', () => {
  const report = fixture('[White "Ada"]\n[Black "Grace"]\n[TimeControl "300+2"]\n\n1. e4 {[%clk 0:05:00]} e5 {[%clk 0:04:58]} 2. Nf3 Nc6 *')
  const imported = parseReviewTransfer(serializeReviewTransfer(report))
  const { importedAt, ...rest } = imported
  assert.deepEqual(rest, JSON.parse(JSON.stringify(report)))
  assert.ok(importedAt && Number.isFinite(Date.parse(importedAt)))
  assert.match(imported.pgn, /\[%clk 0:05:00\]/)
  assert.equal(imported.initialAnalysis.lines.length, 1)
})

test('Chess960 mating castle retains canonical king-to-rook UCI, physical destinations, and variant', () => {
  const report = fixture('[Variant "Chess960"]\n[FEN "4rkr1/4p1p1/8/8/8/8/8/5K1R w H - 0 1"]\n[Result "1-0"]\n\n1. O-O# 1-0')
  const restored = parseReviewTransfer(serializeReviewTransfer(report))
  assert.equal(restored.variant, 'chess960')
  assert.equal(restored.moves[0].uci, 'f1h1')
  assert.equal(restored.moves[0].kingTo, 'g1')
  assert.equal(restored.moves[0].rookTo, 'f1')
  assert.equal(restored.moves[0].evaluation.mate, 0)
})

test('legacy reviews retain their scoring model and old imports receive a new persistent import timestamp', () => {
  const report = fixture()
  delete report.accuracyVersion
  report.moves.forEach(move => { delete move.winningChanceLoss })
  report.importedAt = '2020-01-01T00:00:00Z'
  const imported = parseReviewTransfer(serializeReviewTransfer(report))
  assert.equal(imported.accuracyVersion, undefined)
  assert.equal(imported.moves[0].winningChanceLoss, undefined)
  assert.notEqual(imported.importedAt, report.importedAt)
  assert.ok(Date.parse(imported.importedAt!) >= Date.parse(report.analyzedAt))
})

test('invalid JSON, incompatible envelopes, and oversized files are rejected before opening a report', () => {
  assert.throws(() => parseReviewTransfer('{broken'), /valid JSON/)
  assert.throws(() => parseReviewTransfer('[]'), /Open File review/)
  const serialized = JSON.parse(serializeReviewTransfer(fixture()))
  serialized.formatVersion = 2
  assert.throws(() => parseReviewTransfer(JSON.stringify(serialized)), /format or version/)
  serialized.formatVersion = 1
  serialized.extra = 'unsupported'
  assert.throws(() => parseReviewTransfer(JSON.stringify(serialized)), /format or version/)
  assert.throws(() => parseReviewTransfer(' '.repeat(maxReviewTransferBytes + 1)), /12 MB/)
})

test('finite bounds, known versions, valid dates, and complete metadata are required', () => {
  const changes: ((review: GameReview) => void)[] = [
    review => { review.moves[0].accuracy = NaN },
    review => { review.moves[0].accuracy = 101 },
    review => { review.moves[0].centipawnLoss = -1 },
    review => { review.moves[0].winningChanceLoss = 101 },
    review => { review.moves[0].depth = Infinity },
    review => { review.moves[0].evaluation = { cp: -100, mate: 1 } },
    review => { review.analyzedAt = '2026-02-31T00:00:00Z' },
    review => { review.importedAt = 'yesterday' },
    review => { review.accuracyVersion = 99 as 2 },
    review => { delete review.moves[0].winningChanceLoss },
    review => { review.engine = '' },
    review => { review.engine = '\u0000' },
  ]
  for (const change of changes) assert.throws(() => parseReviewTransfer(mutate(change)), /Invalid review file/)
})

test('PGN positions, moves, players, result, headers, and legal move counts must match the stored report', () => {
  const changes: ((review: GameReview) => void)[] = [
    review => { review.moves[0].san = 'd4' },
    review => { review.moves[0].uci = 'e1e8' },
    review => { review.moves[0].afterFen = review.initialFen },
    review => { review.moves[0].legalMoves = 21 },
    review => { review.moves[0].ply = 20 },
    review => { review.initialFen = review.moves[0].afterFen },
    review => { review.white = 'Other' },
    review => { review.result = '1-0' },
    review => { review.headers.Event = 'Not in PGN' },
    review => { review.moves.pop() },
  ]
  for (const change of changes) assert.throws(() => parseReviewTransfer(mutate(change)), /Invalid review file/)
})

test('illegal or dishonest best/PV/SAN data and inconsistent evaluation history are rejected', () => {
  assert.throws(() => parseReviewTransfer(mutate(review => { review.moves[0].bestMove = 'e1e8' })))
  assert.throws(() => parseReviewTransfer(mutate(review => { review.moves[0].pv = ['e1e8']; review.moves[0].pvSan = ['Ke8'] })))
  assert.throws(() => parseReviewTransfer(mutate(review => { review.moves[0].pvSan = ['fiction'] })), /legal SAN/)
  assert.throws(() => parseReviewTransfer(mutate(review => { review.moves[0].pv = Array(257).fill('e2e4'); review.moves[0].pvSan = Array(257).fill('e4') })), /continuation/)
  assert.throws(() => parseReviewTransfer(mutate(review => { review.moves[1].beforeEvaluation = { cp: 80, mate: null } })), /evaluation history/)
  assert.throws(() => parseReviewTransfer(mutate(review => { review.initialAnalysis.lines[0].rank = 6 })), /candidate line rank/)
})

test('forged summary counts, phase samples, key plies, and overall averages cannot enter saved statistics', () => {
  const changes: ((review: GameReview) => void)[] = [
    review => { review.whiteAccuracy = 0 },
    review => { review.counts.w.best++ },
    review => { review.phases[0].moves++ },
    review => { review.phases[0].whiteAccuracy = 0 },
    review => { review.phases = [] },
    review => { review.keyMoments = [999] },
    review => { review.keyMoments = [1, 1] },
  ]
  for (const change of changes) assert.throws(() => parseReviewTransfer(mutate(change)), /Invalid review file/)
})

test('unknown object fields are rejected while ordinary untrusted prose remains inert data', () => {
  const report = fixture()
  report.moves[0].explanation = '<img src=x onerror=alert(1)> & <script>text only</script>'
  assert.equal(parseReviewTransfer(serializeReviewTransfer(report)).moves[0].explanation, report.moves[0].explanation)
  const envelope = JSON.parse(serializeReviewTransfer(report))
  envelope.review.initialAnalysis.unexpected = '<script>'
  assert.throws(() => parseReviewTransfer(JSON.stringify(envelope)), /unsupported fields/)
  delete envelope.review.initialAnalysis.unexpected
  Object.defineProperty(envelope.review, '__proto__', { value: {}, enumerable: true })
  assert.throws(() => parseReviewTransfer(JSON.stringify(envelope)), /unsupported fields/)
})

test('download filenames cannot contain path separators or markup', () => {
  const report = fixture()
  report.white = '../Ada<script>'
  report.black = 'Grace/..\\'
  const filename = reviewTransferFilename(report)
  assert.match(filename, /^[a-z0-9_-]+\.open-file\.json$/i)
  assert.equal(filename.includes('/'), false)
})
