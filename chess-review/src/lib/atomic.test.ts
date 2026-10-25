import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createPosition, pgnVariant } from './position'
import { gameFromPgn, parseGame } from './game'
import { terminalEvaluation } from '../engine/protocol'
import { positionOutcome } from './play-position'

test('Atomic capture explosions remove adjacent pieces and end on the missing king', () => {
  const pgn = readFileSync(new URL('../test/fixtures/atomic-king-explosion.pgn', import.meta.url), 'utf8')
  const game = gameFromPgn(pgn)
  const parsed = parseGame(game)
  const board = createPosition(parsed.positions[0], parsed.variant)
  const move = board.move(parsed.moves[0].san)
  assert.equal(pgnVariant(pgn), 'atomic')
  assert.equal(game.rules, 'atomic')
  assert.equal(move.san.replace(/#$/, ''), 'Rxh7')
  assert.equal(board.get('h7'), undefined)
  assert.equal(board.get('h8'), undefined)
  assert.deepEqual(board.variantOutcome?.(), { winner: 'w', reason: 'atomic-win' })
  assert.equal(board.isCheckmate(), false)
  assert.equal(board.isGameOver(), true)
  assert.deepEqual(terminalEvaluation(board), { cp: 100000, mate: 0 })
  assert.equal(positionOutcome(board), 'White wins by exploding the opposing king.')
})

test('Atomic default setup and FEN round-trip retain legal moves', () => {
  const board = createPosition(undefined, 'atomic')
  assert.equal(board.moves().length, 20)
  assert.equal(createPosition(board.fen(), 'atomic').fen(), board.fen())
})
