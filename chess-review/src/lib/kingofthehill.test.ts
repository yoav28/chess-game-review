import assert from 'node:assert/strict'
import test from 'node:test'
import { createPosition, pgnVariant } from './position'
import { gameFromPgn, parseGame } from './game'
import { positionOutcome } from './play-position'

test('King of the Hill PGN replays a center-square win under variant rules', () => {
  const pgn = `[Event "King of the Hill"]
[Variant "King of the Hill"]
[SetUp "1"]
[FEN "7k/8/8/8/8/2K5/8/8 w - - 0 1"]
[Result "1-0"]

1. Kd4 1-0`
  const game = gameFromPgn(pgn)
  const parsed = parseGame(game)
  const board = createPosition(parsed.positions.at(-1), parsed.variant)
  assert.equal(pgnVariant(pgn), 'kingofthehill')
  assert.equal(game.rules, 'kingofthehill')
  assert.equal(parsed.moves.length, 1)
  assert.deepEqual(board.variantOutcome?.(), { winner: 'w', reason: 'king-of-the-hill' })
  assert.equal(board.isCheckmate(), false)
  assert.equal(board.isGameOver(), true)
  assert.deepEqual(board.moves(), [])
  assert.equal(positionOutcome(board), 'White wins by reaching the hill.')
})

test('King of the Hill starts from orthodox chess and rejects the wrong rules explicitly', () => {
  const board = createPosition(undefined, 'kingofthehill')
  assert.equal(board.moves().length, 20)
  assert.equal(createPosition(board.fen(), 'kingofthehill').fen(), board.fen())
  assert.equal(pgnVariant('[Variant "KOTH"]'), 'kingofthehill')
  assert.throws(() => parseGame({ ...gameFromPgn(`[Variant "King of the Hill"]\n\n1. e4 *`), rules: 'chess' }), /conflicts with the selected game rules/)
})
