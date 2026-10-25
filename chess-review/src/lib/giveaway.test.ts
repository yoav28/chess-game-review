import test from 'node:test'
import assert from 'node:assert/strict'
import { createPosition, pgnVariant } from './position'
import { engineRules, gameFromPgn, parseGame } from './game'
import { reviewFixture } from '../test/review-fixture'
import { reviewedPgn } from './report'
import { parseReviewTransfer, serializeReviewTransfer } from './review-transfer'
import { readFileSync } from 'node:fs'

const pgn = readFileSync(new URL('../test/fixtures/giveaway-capture.pgn', import.meta.url), 'utf8')

test('Giveaway PGN uses compulsory captures and preserves the variant', () => {
  assert.equal(pgnVariant(pgn), 'giveaway')
  const game = gameFromPgn(pgn)
  assert.equal(game.rules, 'giveaway')
  assert.equal(engineRules(game.rules), 'giveaway')
  const parsed = parseGame(game)
  assert.equal(parsed.variant, 'giveaway')
  assert.deepEqual(parsed.moves.map(move => move.san), ['e3', 'd5', 'Qh5', 'g6', 'Qxg6', 'hxg6'])
  const capture = createPosition(parsed.moves[4].before, 'giveaway')
  assert.ok(capture.moves().includes('Qxg6'))
  assert.ok(capture.moves({ verbose: true }).every(move => move.captured))
})

test('Giveaway disables check and gives the win to a stalemated player', () => {
  const attacked = createPosition('k7/8/8/8/8/8/8/R6K w - - 0 1', 'giveaway')
  assert.equal(attacked.isCheck(), false)
  assert.deepEqual(attacked.moves(), ['Rxa8'])
  const stalemate = createPosition('RRRRRRNk/PPPPPPRP/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP/KRRRRRRR w - - 0 1', 'giveaway')
  assert.equal(stalemate.moves().length, 0)
  assert.deepEqual(stalemate.variantOutcome?.(), { winner: 'w', reason: 'giveaway-win' })
  assert.equal(stalemate.isGameOver(), true)
})

test('Giveaway permits promotion to a king and encodes it in UCI', () => {
  const board = createPosition('7k/P7/8/8/8/8/8/4K3 w - - 0 1', 'giveaway')
  assert.ok(board.moves({ square: 'a7', verbose: true }).some(move => move.promotion === 'k'))
  const promotion = board.move('a7a8k')
  assert.equal(promotion.san, 'a8=K')
  assert.equal(promotion.uci, 'a7a8k')
  assert.equal(createPosition(promotion.after, 'giveaway').get('a8')?.type, 'k')
})

test('Giveaway king promotion survives annotated PGN and portable review transfer', () => {
  const review = reviewFixture('[Variant "Giveaway"]\n[FEN "7k/P7/8/8/8/8/8/4K3 w - - 0 1"]\n[Result "*"]\n\n1. a8=K *')
  assert.equal(review.moves[0].uci, 'a7a8k')
  const exported = parseGame(gameFromPgn(reviewedPgn(review)))
  assert.equal(exported.variant, 'giveaway')
  assert.equal(exported.moves[0].uci, 'a7a8k')
  const imported = parseReviewTransfer(serializeReviewTransfer(review))
  assert.equal(imported.variant, 'giveaway')
  assert.equal(imported.moves[0].uci, 'a7a8k')
})
