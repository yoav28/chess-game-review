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
  assert.deepEqual(skillThemeGroups(review).map(group => group.themes.map(theme => theme.key)), [
    ['captures', 'checks', 'castles', 'checkmates', 'free-pieces', 'defends-pieces', 'retreats'],
    ['develops-pieces', 'pawns-in-center', 'strikes-at-center', 'connects-rooks', 'completes-development', 'one-book-move', 'two-book-moves', 'three-book-moves', 'four-book-moves', 'fianchettos'],
    ['recaptures', 'winning-captures', 'blocks-attacks', 'forks', 'pins', 'defends-checkmates', 'absolute-pins', 'discovered-attacks', 'knight-forks', 'skewers', 'attacks-pinned-pieces', 'traps-pieces', 'removes-defenders', 'royal-forks', 'discovered-checks', 'counter-threats', 'defends-tactics', 'exploits-pins', 'double-checks', 'brilliant-sacrifices', 'queen-sacrifices'],
    ['equal-trades', 'powerful-bishops', 'rooks-to-open-files', 'kicks', 'outposts', 'trading-to-simplify', 'doubles-rooks', 'creates-batteries', 'prevents-castling', 'wins-tempo', 'avoids-trades', 'develops-with-tempo', 'damages-pawn-structure', 'en-passant', 'improves-pawn-structure', 'pawn-storms'],
    ['promotions', 'ladder-mates', 'backrank-mates', 'passed-pawns', 'queen-checkmates', 'rook-checkmates', 'makes-passed-pawns', 'active-king', 'seventh-rank-rook', 'rook-supports-passed-pawn', 'opposition', 'connects-rooks-seventh', 'rook-blocks-passed-pawn', 'protected-passed-pawns', 'king-pawn-endgames', 'queen-endgames', 'rook-endgames', 'knight-bishop-endgames'],
  ])
  const fundamentals = themeCounts(review, 'fundamentals')
  const openings = themeCounts(review, 'openings')
  assert.deepEqual(fundamentals.castles, { w: [7], b: [] })
  assert.deepEqual(openings['develops-pieces'], { w: [3, 5], b: [4, 6] })
  assert.deepEqual(openings['pawns-in-center'], { w: [1], b: [2] })
  assert.ok(themeCounts(review, 'openings')['strikes-at-center'].w.includes(1))
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
  assert.deepEqual(themeCounts(tactics, 'strategy')['en-passant'], { w: [5], b: [] })
  assert.deepEqual(tacticalThemes.recaptures, { w: [], b: [] })
  const recapture = reviewFixture('1. e4 d5 2. exd5 Qxd5 *')
  assert.deepEqual(themeCounts(recapture, 'tactics').recaptures, { w: [], b: [4] })
  assert.deepEqual(themeCounts(recapture, 'strategy')['equal-trades'], { w: [], b: [4] })
  const queenSacrifice = reviewFixture('1. e3 d5 2. Qh5 g6 3. Qxg6 hxg6 *')
  assert.deepEqual(themeCounts(queenSacrifice, 'tactics')['queen-sacrifices'], { w: [5], b: [] })
  const skewer = reviewFixture('[FEN "r6k/q7/8/8/8/8/8/1R5K w - - 0 1"]\n\n1. Ra1 *')
  const skewerThemes = themeCounts(skewer, 'tactics')
  assert.deepEqual(skewerThemes.skewers, { w: [1], b: [] })
  assert.deepEqual(themeCounts(skewer, 'strategy').kicks, { w: [1], b: [] })
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

test('pin, counter-threat, tactical defense, and passed-pawn creation themes use board geometry', () => {
  const pin = reviewFixture('[FEN "4k3/8/2n5/8/2B5/8/8/4K3 w - - 0 1"]\n\n1. Bb5 *')
  assert.deepEqual(themeCounts(pin, 'tactics')['absolute-pins'], { w: [1], b: [] })

  const exploit = reviewFixture('[FEN "4k3/p7/2n5/8/2B5/8/8/4K3 w - - 0 1"]\n\n1. Bb5 a6 2. Bxc6+ *')
  assert.deepEqual(themeCounts(exploit, 'tactics')['exploits-pins'], { w: [3], b: [] })

  const counter = reviewFixture('[FEN "3r3k/6q1/8/8/3N4/8/8/7K w - - 0 1"]\n\n1. Ne6 *')
  assert.deepEqual(themeCounts(counter, 'tactics')['counter-threats'], { w: [1], b: [] })

  const defense = reviewFixture('[FEN "7k/8/8/8/4B3/4R3/2n5/K7 w - - 0 1"]\n\n1. Bxc2 *')
  assert.deepEqual(themeCounts(defense, 'tactics')['defends-tactics'], { w: [1], b: [] })

  const createsPasser = reviewFixture('[FEN "7k/8/8/2p5/3P4/8/8/K7 w - - 0 1"]\n\n1. dxc5 *')
  assert.deepEqual(themeCounts(createsPasser, 'endgames')['makes-passed-pawns'], { w: [1], b: [] })
})

test('ladder mates require a cooperating major piece rather than any rook or queen mate', () => {
  const ladder = reviewFixture('[FEN "7k/5KR1/8/8/8/8/8/R7 w - - 0 1"]\n\n1. Ra8# *')
  assert.deepEqual(themeCounts(ladder, 'endgames')['ladder-mates'], { w: [1], b: [] })

  const queenMate = reviewFixture('[FEN "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"]\n\n1. Qf8# *')
  assert.deepEqual(themeCounts(queenMate, 'endgames')['ladder-mates'], { w: [], b: [] })
  assert.deepEqual(themeCounts(queenMate, 'endgames')['queen-checkmates'], { w: [1], b: [] })
})
