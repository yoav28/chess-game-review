import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createPosition, pgnVariant, positionMoveUci } from './position'
import { gameFromPgn, parseGame } from './game'

const pgn = readFileSync(new URL('../test/fixtures/crazyhouse-pocket-drop.pgn', import.meta.url), 'utf8')

test('Crazyhouse PGN replay retains pockets and legal drop moves', () => {
  const game = gameFromPgn(pgn)
  const parsed = parseGame(game)
  assert.equal(pgnVariant(pgn), 'crazyhouse')
  assert.equal(game.rules, 'crazyhouse')
  assert.equal(parsed.moves.at(-1)?.drop, 'p')
  assert.equal(parsed.moves.at(-1)?.san, 'P@e5')
  assert.equal(parsed.moves.at(-1)?.uci, 'P@e5')
  const board = createPosition(parsed.positions.at(-1), parsed.variant)
  assert.equal(board.get('e5')?.type, 'p')
  assert.equal(board.pockets?.()?.w.p, undefined)
  assert.ok(board.fen().includes('['))
})

test('captured Crazyhouse pieces enter the mover pocket and generate drops', () => {
  const board = createPosition(undefined, 'crazyhouse')
  assert.equal(board.moves().length, 20)
  for (const san of ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5']) board.move(san)
  assert.equal(board.pockets?.()?.w.p, 1)
  const drops = board.moves({ verbose: true }).filter(move => move.drop === 'p')
  assert.ok(drops.length > 0)
  assert.ok(drops.some(move => positionMoveUci(move) === 'P@e5'))
  const dropped = board.move('P@e5')
  assert.equal(dropped.drop, 'p')
  assert.equal(board.get('e5')?.type, 'p')
  assert.equal(board.pockets?.()?.w.p, undefined)
})
