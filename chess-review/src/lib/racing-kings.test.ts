import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPosition, pgnVariant } from './position'
import { gameFromPgn, parseGame } from './game'
import { positionOutcome } from './play-position'

const winPgn = readFileSync(new URL('../test/fixtures/racing-kings-win.pgn', import.meta.url), 'utf8')
const drawPgn = readFileSync(new URL('../test/fixtures/racing-kings-draw.pgn', import.meta.url), 'utf8')

test('Racing Kings PGN uses its dedicated initial position and rules', () => {
  const board = createPosition(undefined, 'racingkings')
  assert.equal(board.fen(), '8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1')
  assert.equal(pgnVariant('[Variant "Racing Kings"]'), 'racingkings')
  const parsed = parseGame(gameFromPgn(winPgn))
  assert.equal(parsed.variant, 'racingkings')
  assert.equal(parsed.moves[0].san, 'Ka8')
  assert.equal(positionOutcome(createPosition(parsed.positions.at(-1), 'racingkings')), 'White wins by reaching the eighth rank first.')
})

test('Racing Kings forbids checks and draws when Black follows White to the eighth rank', () => {
  const board = createPosition('K7/6k1/8/8/8/8/8/8 b - - 0 1', 'racingkings')
  assert.equal(board.isCheck(), false)
  assert.equal(board.variantOutcome?.(), null)
  const legalMoves = board.moves({ verbose: true })
  assert.ok(legalMoves.some(move => move.uci === 'g7g8'))
  for (const move of legalMoves) assert.equal(createPosition(move.after, 'racingkings').isCheck(), false)
  const parsed = parseGame(gameFromPgn(drawPgn))
  assert.equal(parsed.moves[0].san, 'Kg8')
  const final = createPosition(parsed.positions.at(-1), 'racingkings')
  assert.deepEqual(final.variantOutcome?.(), { winner: undefined, reason: 'racing-kings-win' })
  assert.equal(positionOutcome(final), 'Draw.')
})
