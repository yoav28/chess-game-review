import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { createPosition, pgnVariant, positionMoveUci, resolveVariant } from './position'

test('factory detects Shredder rights and preserves explicit Chess960 after castling rights disappear', () => {
  const fen = '4k3/8/8/8/8/8/8/5K1R w H - 0 1'
  const board = createPosition(fen)
  assert.equal(resolveVariant(fen), 'chess960')
  assert.equal(positionMoveUci(board.move('O-O')), 'f1h1')
  assert.equal(createPosition(board.fen(), 'chess960').fen(), board.fen())
  assert.equal(resolveVariant(board.fen(), 'chess960'), 'chess960')
  assert.throws(() => createPosition(fen, 'chess'), /cannot use standard/)
  assert.throws(() => createPosition(undefined, 'chess960'), /starting FEN/)
})

test('factory keeps standard move and castling encodings unchanged', () => {
  const ordinary = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1')
  const board = createPosition(ordinary.fen(), 'chess')
  assert.equal(positionMoveUci(board.move('O-O')), 'e1g1')
  assert.equal(board.fen(), ordinary.move('O-O').after)
})

test('variant parsing accepts known labels and rejects unsupported variants rather than falling back', () => {
  assert.equal(pgnVariant('1. e4 *'), 'chess')
  assert.equal(pgnVariant('[Variant "Chess960"]'), 'chess960')
  assert.equal(pgnVariant('[Variant "Fischerandom"]'), 'chess960')
  assert.equal(pgnVariant('[Variant "Atomic"]'), 'atomic')
  assert.equal(pgnVariant('[Variant "Horde"]'), 'horde')
  assert.equal(pgnVariant('[Variant "Crazyhouse"]'), 'crazyhouse')
  assert.throws(() => pgnVariant('[Variant "Racing Kings"]'), /not supported/)
})
