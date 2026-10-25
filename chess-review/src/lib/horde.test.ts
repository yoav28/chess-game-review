import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createPosition, pgnVariant } from './position'
import { gameFromPgn, parseGame } from './game'
import { terminalEvaluation } from '../engine/protocol'
import { positionOutcome } from './play-position'

test('Horde PGN uses its asymmetric rules and ends when the horde army is eliminated', () => {
  const pgn = readFileSync(new URL('../test/fixtures/horde-army-eliminated.pgn', import.meta.url), 'utf8')
  const game = gameFromPgn(pgn)
  const parsed = parseGame(game)
  const board = createPosition(parsed.positions[0], parsed.variant)
  board.move(parsed.moves[0].san)
  assert.equal(pgnVariant(pgn), 'horde')
  assert.equal(game.rules, 'horde')
  assert.equal(board.get('a2')?.type, 'r')
  assert.equal(board.get('a2')?.color, 'b')
  assert.equal(board.board().flat().some(piece => piece?.color === 'w'), false)
  assert.deepEqual(board.variantOutcome?.(), { winner: 'b', reason: 'horde-win' })
  assert.equal(board.isGameOver(), true)
  assert.deepEqual(terminalEvaluation(board), { cp: -100000, mate: 0 })
  assert.equal(positionOutcome(board), 'Black wins by eliminating the opposing army.')
})

test('Horde uses its native starting army and variant PGN moves', () => {
  const board = createPosition(undefined, 'horde')
  assert.ok(board.board().flat().filter(Boolean).length > 32)
  assert.ok(board.moves().length > 0)
  assert.equal(createPosition(board.fen(), 'horde').fen(), board.fen())
})
