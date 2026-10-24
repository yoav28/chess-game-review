import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import { reviewFixture } from '../test/review-fixture'
import { createPosition } from './position'
import { embedPuzzleData } from './embed-puzzle'
import { buildReviewEmbed } from './review-embed'

test('puzzle exports legal alternatives and exact recorded moves only for the guessing side', () => {
  const review = reviewFixture()
  const puzzle = embedPuzzleData(review, 0)
  assert.equal(puzzle.side, 'w')
  assert.ok(puzzle.turns[0].some(move => move.san === 'e3' && move.uci !== puzzle.expected[0]))
  assert.equal(puzzle.turns[1].length, 0)
  for (const [index, moves] of puzzle.turns.entries()) {
    if (!moves.length) continue
    assert.equal(moves.find(move => move.uci === puzzle.expected[index])!.fen, review.moves[index].afterFen)
    for (const move of moves) assert.equal(createPosition(review.moves[index].beforeFen).move(move.uci).after, move.fen)
  }
  const embed = buildReviewEmbed(review, {}, { puzzle: true })
  const data = JSON.parse(embed.document.match(/id="review-data">([\s\S]*?)<\/script>/)![1])
  assert.equal(data.selected, 0)
  assert.deepEqual(data.puzzle, JSON.parse(JSON.stringify(puzzle)))
  assert.doesNotThrow(() => new Script(embed.document.match(/<script>([\s\S]*?)<\/script>/)![1]))
  assert.match(embed.iframe, /sandbox="allow-scripts"/)
})

test('starting on a Black turn skips earlier positions and selects the correct replies', () => {
  const review = reviewFixture()
  const puzzle = embedPuzzleData(review, 1)
  assert.equal(puzzle.start, 1)
  assert.equal(puzzle.side, 'b')
  assert.equal(puzzle.turns[0].length, 0)
  assert.ok(puzzle.turns[1].some(move => move.uci === review.moves[1].uci))
  assert.equal(puzzle.turns[2].length, 0)
  assert.throws(() => embedPuzzleData(review, review.moves.length), /before the final move/)
  assert.throws(() => embedPuzzleData(review, -1), /valid puzzle starting/)
  assert.throws(() => embedPuzzleData(review, 1.5), /valid puzzle starting/)
})

test('puzzle choices preserve all four promotions and en-passant capture positions', () => {
  const promotion = reviewFixture('[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=N *')
  const choices = embedPuzzleData(promotion, 0).turns[0].filter(move => move.from === 'a7' && move.to === 'a8')
  assert.deepEqual(choices.map(move => move.promotion).sort(), ['b', 'n', 'q', 'r'])
  assert.match(choices.find(move => move.promotion === 'n')!.fen, /^N6k/)
  const ep = reviewFixture('[FEN "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2"]\n\n2. exd6 *')
  const move = embedPuzzleData(ep, 0).turns[0].find(move => move.uci === 'e5d6')!
  assert.equal(createPosition(move.fen).get('d5'), undefined)
  assert.equal(createPosition(move.fen).get('d6')!.type, 'p')
})

test('Chess960 puzzle separates canonical castle input from physical destinations', () => {
  const review = reviewFixture('[Variant "Chess960"]\n[FEN "4k3/8/8/8/8/8/8/6KR w H - 0 1"]\n\n1. O-O *')
  const move = embedPuzzleData(review, 0).turns[0].find(move => move.san === 'O-O')!
  assert.equal(move.uci, 'g1h1')
  assert.equal(move.from, 'g1')
  assert.equal(move.to, 'g1')
  assert.equal(move.rookFrom, 'h1')
  assert.equal(createPosition(move.fen, 'chess960').get('f1')!.type, 'r')
})

test('three-check puzzle retains counters, variant terminal outcome and legal alternatives', () => {
  const review = reviewFixture(readFileSync(new URL('../test/fixtures/three-check-78864833399.pgn', import.meta.url), 'utf8'))
  const puzzle = embedPuzzleData(review, 51)
  assert.equal(puzzle.side, 'b')
  const win = puzzle.turns[51].find(move => move.uci === puzzle.expected[51])!
  assert.match(win.fen, /\+1\+3$/)
  const board = createPosition(win.fen, 'threecheck')
  assert.deepEqual(board.variantOutcome?.(), { winner: 'b', reason: 'third-check' })
  assert.equal(board.isCheckmate(), false)
  assert.equal(board.moves().length, 0)
  const embed = buildReviewEmbed(review, {}, { puzzle: true, ply: 51 })
  assert.ok(embed.document.includes('Black wins by delivering the third check.'))
})
