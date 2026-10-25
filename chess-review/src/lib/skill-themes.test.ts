import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewFixture } from '../test/review-fixture'
import { skillTabs, skillThemeGroups } from './skill-themes'

function themeCounts(review: ReturnType<typeof reviewFixture>, tab: 'fundamentals' | 'openings' | 'tactics' | 'strategy' | 'endgames') {
  const group = skillThemeGroups(review).find(item => item.key === tab)!
  return Object.fromEntries(group.themes.map(theme => [theme.key, theme.plies]))
}

test('skills panel exposes the five source-level categories with local heuristic theme detections', () => {
  assert.deepEqual(skillTabs.map(tab => tab.label), ['Fundamentals', 'Openings', 'Tactics', 'Strategy', 'Endgames'])
  const review = reviewFixture('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O *')
  const fundamentals = themeCounts(review, 'fundamentals')
  const openings = themeCounts(review, 'openings')
  const strategy = themeCounts(review, 'strategy')
  assert.deepEqual(fundamentals.castles, { w: [7], b: [] })
  assert.deepEqual(openings['develops-pieces'], { w: [3, 5], b: [4, 6] })
  assert.deepEqual(openings['pawns-in-center'], { w: [1], b: [2] })
  assert.ok(strategy['center-control'].w.includes(1))
})

test('opening book milestones count each player’s recorded book moves', () => {
  const review = reviewFixture('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 *')
  review.moves.filter(move => move.color === 'w').forEach(move => { move.classification = 'book' })
  const openings = themeCounts(review, 'openings')
  assert.deepEqual(openings['one-book-move'].w, [1])
  assert.deepEqual(openings['two-book-moves'].w, [3])
  assert.deepEqual(openings['three-book-moves'].w, [5])
  assert.deepEqual(openings['four-book-moves'].w, [7])
})

test('tactical and endgame themes use recorded legal moves and board facts', () => {
  const tactics = reviewFixture('1. e4 a6 2. e5 d5 3. exd6 *')
  const tacticalThemes = themeCounts(tactics, 'tactics')
  assert.deepEqual(tacticalThemes['en-passant'], { w: [5], b: [] })
  assert.deepEqual(tacticalThemes.recaptures, { w: [], b: [] })
  const recapture = reviewFixture('1. e4 d5 2. exd5 Qxd5 *')
  assert.deepEqual(themeCounts(recapture, 'tactics').recaptures, { w: [], b: [4] })
  assert.deepEqual(themeCounts(recapture, 'strategy')['equal-trades'], { w: [], b: [4] })
  const queenSacrifice = reviewFixture('1. e3 d5 2. Qh5 g6 3. Qxg6 hxg6 *')
  assert.deepEqual(themeCounts(queenSacrifice, 'tactics')['queen-sacrifices'], { w: [5], b: [] })
  const skewer = reviewFixture('[FEN "r6k/q7/8/8/8/8/8/1R5K w - - 0 1"]\n\n1. Ra1 *')
  const skewerThemes = themeCounts(skewer, 'tactics')
  assert.deepEqual(skewerThemes.skewers, { w: [1], b: [] })
  assert.deepEqual(skewerThemes.kicks, { w: [1], b: [] })
  const promotion = reviewFixture('[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *')
  assert.deepEqual(themeCounts(promotion, 'endgames').promotions, { w: [1], b: [] })
  assert.deepEqual(themeCounts(promotion, 'endgames')['passed-pawns'], { w: [1], b: [] })
})

test('passed-pawn and fianchetto themes require the recorded destination and setup', () => {
  const sameRankEnemyPawn = reviewFixture('[FEN "7k/8/8/2p5/3P4/8/8/K7 w - - 0 1"]\n\n1. d5 *')
  assert.deepEqual(themeCounts(sameRankEnemyPawn, 'endgames')['passed-pawns'], { w: [1], b: [] })

  const pawnStillAhead = reviewFixture('[FEN "7k/8/2p5/8/3P4/8/8/K7 w - - 0 1"]\n\n1. d5 *')
  assert.deepEqual(themeCounts(pawnStillAhead, 'endgames')['passed-pawns'], { w: [], b: [] })

  const fianchetto = reviewFixture('1. g3 d5 2. Bg2 *')
  assert.deepEqual(themeCounts(fianchetto, 'openings').fianchettos, { w: [3], b: [] })

  const bishopCapture = reviewFixture('[FEN "7k/8/8/8/8/B7/1r6/K7 w - - 0 1"]\n\n1. Bxb2 *')
  assert.deepEqual(themeCounts(bishopCapture, 'openings').fianchettos, { w: [], b: [] })
})
