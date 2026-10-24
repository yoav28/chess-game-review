import test from 'node:test'
import assert from 'node:assert/strict'
import { bestMoveArrow, continuationArrows } from './board-visuals'
import { createPosition } from './position'

test('only legal replayed engine moves become visual arrows', () => {
  const fen = createPosition().fen()
  assert.deepEqual(continuationArrows(fen, ['e2e4', 'e7e5']), [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }])
  assert.deepEqual(continuationArrows(fen, ['e2e4', 'e2e5']), [{ from: 'e2', to: 'e4' }])
  assert.equal(bestMoveArrow(fen, 'a1a8'), undefined)
})

test('Chess960 castling arrows use actual king movement rather than the rook-origin UCI target', () => {
  assert.equal(bestMoveArrow('k7/8/8/8/8/8/8/5K1R w H - 0 1', 'f1h1', 'chess960'), 'f1g1')
  assert.equal(bestMoveArrow('k7/8/8/8/8/8/8/6KR w H - 0 1', 'g1h1', 'chess960'), 'h1f1')
})
