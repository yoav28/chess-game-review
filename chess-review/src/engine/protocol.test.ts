import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { boardWithHistory, completedLines, parseInfo, terminalEvaluation, variationToSan } from './protocol'

test('UCI centipawn scores are normalized to White and PVs are legal SAN', () => {
  const chess = new Chess()
  chess.move('e4')
  const info = parseInfo('info depth 14 multipv 2 score cp 36 nodes 1842 pv e7e5 g1f3 b8c6', chess.fen())
  assert.equal(info?.evaluation.cp, -36)
  assert.equal(info?.rank, 2)
  assert.equal(info?.depth, 14)
  assert.deepEqual(info?.pvSan, ['e5', 'Nf3', 'Nc6'])
})

test('mate scores preserve the winning side when Black is to move', () => {
  const chess = new Chess()
  chess.move('e4')
  const winningBlack = parseInfo('info depth 12 score mate 3 pv e7e5', chess.fen())
  const losingBlack = parseInfo('info depth 12 score mate -3 pv e7e5', chess.fen())
  assert.equal(winningBlack?.evaluation.mate, -3)
  assert.ok((winningBlack?.evaluation.cp ?? 0) < -90000)
  assert.equal(losingBlack?.evaluation.mate, 3)
  assert.ok((losingBlack?.evaluation.cp ?? 0) > 90000)
})

test('partial UCI and bound scores do not create fabricated evaluations', () => {
  const fen = new Chess().fen()
  assert.equal(parseInfo('info depth 2 nodes 10', fen), null)
  assert.equal(parseInfo('info depth 9 score cp 91 lowerbound pv e2e4', fen), null)
  assert.deepEqual(variationToSan(fen, ['e2e4', 'e2e5', 'g1f3']), ['e4'])
})

test('checkmate and drawn terminal positions have exact terminal evaluations', () => {
  const chess = new Chess()
  for (const san of ['f3', 'e5', 'g4', 'Qh4#']) chess.move(san)
  assert.deepEqual(terminalEvaluation(chess), { cp: -100000, mate: 0 })
  const stalemate = new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1')
  assert.deepEqual(terminalEvaluation(stalemate), { cp: 0, mate: null })
  assert.equal(terminalEvaluation(new Chess()), null)
})

test('a stopped MultiPV search uses one completed iteration rather than mixed depths or bounds', () => {
  const fen = new Chess().fen()
  const records = [
    'info depth 10 multipv 1 score cp 30 pv e2e4 e7e5',
    'info depth 10 multipv 2 score cp 10 pv d2d4 d7d5',
    'info depth 11 multipv 1 score cp 55 pv g1f3 d7d5',
    'info depth 11 multipv 2 score cp 12 upperbound pv d2d4 d7d5',
  ].map(line => parseInfo(line, fen)).filter(line => line !== null)
  const selected = completedLines(records, 2)
  assert.deepEqual(selected.map(line => [line.rank, line.depth]), [[1, 10], [2, 10]])
  assert.equal(selected[0].pv[0], 'e2e4')
})

test('history restores threefold repetition and rejects mismatched position histories', () => {
  const board = new Chess()
  const initialFen = board.fen()
  const moves = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']
  for (const uci of moves) board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) })
  assert.equal(new Chess(board.fen()).isThreefoldRepetition(), false)
  assert.deepEqual(terminalEvaluation(boardWithHistory(board.fen(), { initialFen, moves })), { cp: 0, mate: null })
  assert.throws(() => boardWithHistory(initialFen, { initialFen, moves: ['e2e4'] }), /does not match/)
})

test('UCI mate zero means the side to move is checkmated', () => {
  const chess = new Chess()
  chess.loadPgn('1. f3 e5 2. g4 Qh4# 0-1')
  assert.equal(parseInfo('info depth 0 score mate 0 pv a2a3', chess.fen())?.evaluation.cp, -100000)
})

test('Chess960 PV castling uses canonical king-to-rook UCI and SAN without standard fallback', () => {
  const fen = '4rkr1/4p1p1/8/8/8/8/8/5K1R w H - 0 1'
  assert.deepEqual(variationToSan(fen, ['f1h1'], 'chess960'), ['O-O#'])
  const info = parseInfo('info depth 10 score mate 1 pv f1h1', fen, 'chess960')
  assert.deepEqual(info?.pvSan, ['O-O#'])
  assert.equal(info?.evaluation.mate, 1)
  assert.throws(() => variationToSan(fen, ['f1h1'], 'chess'), /cannot use standard/)
})

test('Chess960 history preserves variant and physical rook movement after castling', () => {
  const initialFen = '4k3/8/8/8/8/8/8/5K1R w H - 0 1'
  const target = '4k3/8/8/8/8/8/8/5RK1 b - - 1 1'
  const board = boardWithHistory(target, { initialFen, moves: ['f1h1'] }, 'chess960')
  assert.equal(board.get('g1')?.type, 'k')
  assert.equal(board.get('f1')?.type, 'r')
  assert.equal(board.fen(), target)
})
