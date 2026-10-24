import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chess.js'
import { createPosition, pgnVariant, resolveVariant } from './position'
import { gameFromPgn, parseGame } from './game'
import { terminalEvaluation, engineFen } from '../engine/protocol'
import { positionOutcome } from './play-position'

test('actual third-check game preserves every move, clock, counter and its distinct terminal outcome', () => {
  const pgn = readFileSync(new URL('../test/fixtures/three-check-78864833399.pgn', import.meta.url), 'utf8')
  const game = { ...gameFromPgn(pgn), rules: 'threecheck' }
  const parsed = parseGame(game)
  assert.equal(parsed.variant, 'threecheck')
  assert.equal(parsed.moves.length, 52)
  assert.equal(parsed.clocks.filter(clock => clock !== null).length, 52)
  const board = createPosition(parsed.positions.at(-1), parsed.variant)
  assert.deepEqual(board.checksRemaining?.(), { w: 2, b: 0 })
  assert.deepEqual(board.variantOutcome?.(), { winner: 'b', reason: 'third-check' })
  assert.equal(board.isCheckmate(), false)
  assert.equal(new Chess(board.fen().split(' ').slice(0, 6).join(' ')).isCheckmate(), false)
  assert.equal(board.isGameOver(), true)
  assert.deepEqual(board.moves(), [])
  assert.deepEqual(terminalEvaluation(board), { cp: -100000, mate: 0 })
  assert.equal(positionOutcome(board), 'Black wins by delivering the third check.')
})

test('a resignation after two checks stays nonterminal under the position rules', () => {
  const pgn = readFileSync(new URL('../test/fixtures/three-check-61860050863.pgn', import.meta.url), 'utf8')
  const parsed = parseGame({ ...gameFromPgn(pgn), rules: 'threecheck' })
  const board = createPosition(parsed.positions.at(-1), parsed.variant)
  assert.equal(parsed.moves.length, 5)
  assert.equal(parsed.result, '1-0')
  assert.deepEqual(board.checksRemaining?.(), { w: 1, b: 3 })
  assert.equal(board.isGameOver(), false)
})

test('counter formats normalize, infer three-check and round trip to the engine format', () => {
  const board = createPosition(undefined, 'threecheck')
  assert.equal(resolveVariant(board.fen()), 'threecheck')
  assert.equal(pgnVariant('[Variant "3-check"]'), 'threecheck')
  const wire = engineFen(board.fen(), 'threecheck')
  assert.match(wire, / 3\+3 0 1$/)
  assert.equal(createPosition(wire, 'threecheck').fen(), board.fen())
  assert.throws(() => createPosition(board.fen(), 'chess'), /three-check counters/)
  assert.throws(() => createPosition(new Chess().fen(), 'threecheck'), /check counters/)
  assert.throws(() => createPosition(board.fen().replace('+0+0', '+3+3'), 'threecheck'), /Invalid three-check/)
})

test('standard castling UCI, undo, and check-delivery histories retain their counters', () => {
  const board = createPosition('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1 +1+0', 'threecheck')
  const initial = board.fen()
  const move = board.move('O-O')
  assert.equal(move.uci, 'e1g1')
  assert.equal(move.to, 'g1')
  assert.equal(board.get('f1')?.type, 'r')
  assert.deepEqual(board.checksRemaining?.(), { w: 2, b: 3 })
  board.undo()
  assert.equal(board.fen(), initial)
})

test('a bishop can deliver three checks while bare kings are insufficient', () => {
  assert.equal(createPosition('7k/8/8/8/8/8/8/K1B5 w - - 0 1 +0+0', 'threecheck').isInsufficientMaterial(), false)
  assert.equal(createPosition('7k/8/8/8/8/8/8/K7 w - - 0 1 +0+0', 'threecheck').isInsufficientMaterial(), true)
})

test('repetition identity includes check counters and the third check precedes a fifty-move draw', () => {
  const board = createPosition('7k/8/8/8/8/8/8/K4R2 w - - 0 1 +0+0', 'threecheck')
  for (let cycle = 0; cycle < 2; cycle++) for (const san of ['Rh1+', 'Kg8', 'Rf1', 'Kh8']) board.move(san)
  assert.deepEqual(board.checksRemaining?.(), { w: 1, b: 3 })
  assert.equal(board.isThreefoldRepetition(), false)
  const checking = createPosition(board.fen().replace('8 5', '99 5'), 'threecheck')
  checking.move('Rh1#')
  assert.deepEqual(checking.variantOutcome?.(), { winner: 'w', reason: 'third-check' })
  assert.equal(checking.isDrawByFiftyMoves(), true)
  assert.equal(checking.isDraw(), false)
})

test('ordinary checkmate still ends a three-check game before three checks are delivered', () => {
  const board = createPosition(undefined, 'threecheck')
  for (const san of ['f3', 'e5', 'g4', 'Qh4#']) board.move(san)
  assert.equal(board.isCheckmate(), true)
  assert.equal(board.variantOutcome?.(), null)
  assert.deepEqual(board.checksRemaining?.(), { w: 3, b: 2 })
  assert.equal(positionOutcome(board), 'Black wins by checkmate.')
})
