import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReview, parsePgn } from './review'
import type { PositionAnalysis } from '../engine/types'
import type { SavedReview } from './storage'
import { historyTimeClass, playerHistory, playersInHistory, reviewDate, sortedSavedReviews } from './history'

function fixture(id: string, date = '2026.10.01', accuracy = 80, pgn = '1. e4 e5 2. Nf3 Nc6 *'): SavedReview {
  const game = parsePgn(`[White "Ada"]\n[Black "Grace"]\n[UTCDate "${date}"]\n[TimeControl "180+2"]\n\n${pgn}`)
  const positions = [game.initialFen, ...game.moves.map(move => move.afterFen)].map((fen, index): PositionAnalysis => ({
    fen, evaluation: { cp: 0, mate: null }, bestMove: game.moves[index]?.uci ?? null,
    bestMoveSan: game.moves[index]?.san ?? null, pv: [], pvSan: [], depth: 16, lines: [],
  }))
  const review = buildReview(game, positions)
  review.accuracyVersion = undefined
  review.analyzedAt = '2026-10-24T12:00:00Z'
  review.moves.forEach(move => { move.accuracy = move.color === 'w' ? accuracy : 30 })
  return { id, review }
}

test('history pools actual selected-player move scores and sample counts across either color', () => {
  const white = fixture('white', '2026.10.01', 100)
  const black = fixture('black', '2026.10.02', 5, '1. e4 e5 *')
  black.review.white = 'Other'
  black.review.black = 'aDA'
  black.review.result = '0-1'
  black.review.moves[1].accuracy = 40
  white.review.result = '0-1'
  const summary = playerHistory([white, black], ' ADA ')
  assert.deepEqual(summary.overall, { accuracy: 80, moves: 3, games: 2 })
  assert.deepEqual([summary.wins, summary.losses, summary.draws], [1, 1, 0])
  assert.equal(summary.games, 2)
  assert.equal(summary.trend, null)
  assert.equal(playerHistory([white], 'Missing').overall.accuracy, null)
})

test('categories use move-based evidence, may overlap, and leave absent categories unavailable', () => {
  const entry = fixture('capture', '2026.10.01', 90, '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+ 4. Be2 Nc6 *')
  entry.review.moves[2].accuracy = 50
  entry.review.moves[6].phase = 'middlegame'
  entry.review.moves[6].accuracy = 60
  const summary = playerHistory([entry], 'Ada')
  const categories = Object.fromEntries(summary.categories.map(category => [category.label, category.score]))
  assert.deepEqual(categories.Tactics, { accuracy: 50, moves: 1, games: 1 })
  assert.deepEqual(categories.Opening, { accuracy: 76.7, moves: 3, games: 1 })
  assert.deepEqual(categories.Strategy, { accuracy: 60, moves: 1, games: 1 })
  assert.deepEqual(categories.Endgame, { accuracy: null, moves: 0, games: 0 })
})

test('trend uses dated games and equal windows rather than analysis timestamps or opponents’ scores', () => {
  const entries = [fixture('a', '2026.10.01', 40), fixture('b', '2026.10.02', 60), fixture('c', '2026.10.03', 80), fixture('d', '2026.10.04', 100)]
  entries[0].review.analyzedAt = '2030-01-01T00:00:00Z'
  const { trend } = playerHistory(entries, 'Ada')
  assert.deepEqual(trend, { earlier: { accuracy: 50, moves: 4, games: 2 }, recent: { accuracy: 90, moves: 4, games: 2 }, delta: 40 })
  assert.equal(playerHistory(entries.slice(1), 'Ada').trend, null)
  entries[0].review.headers.UTCDate = '2026.02.31'
  assert.equal(playerHistory(entries, 'Ada').trend, null)
  entries.forEach(entry => { entry.review.headers.UTCDate = '2026.10.01' })
  assert.equal(playerHistory(entries, 'Ada').trend, null)
})

test('malformed dates fall back explicitly to review dates and wholly unknown dates sort last', () => {
  const valid = fixture('valid', '2026.10.04')
  const malformed = fixture('malformed', '2026.02.31')
  const unknown = fixture('unknown', '????.??.??')
  unknown.review.analyzedAt = 'not a date'
  assert.deepEqual(reviewDate(valid.review), { timestamp: Date.parse('2026-10-04T00:00:00Z'), source: 'game' })
  assert.equal(reviewDate(malformed.review).source, 'review')
  assert.deepEqual(reviewDate(unknown.review), { timestamp: null, source: 'unknown' })
  assert.deepEqual(sortedSavedReviews([unknown, valid, malformed]).map(entry => entry.id), ['malformed', 'valid', 'unknown'])
  valid.review.headers.UTCTime = '99:99:99'
  assert.equal(reviewDate(valid.review).source, 'game')
})

test('duplicate ids retain the most recently analyzed review and never inflate history samples', () => {
  const old = fixture('same', '2026.10.01', 10)
  old.review.analyzedAt = '2026-10-01T00:00:00Z'
  const latest = fixture('same', '2026.10.01', 100)
  const original = [old, latest]
  assert.equal(sortedSavedReviews(original).length, 1)
  assert.equal(sortedSavedReviews(original)[0], latest)
  assert.equal(playerHistory(original, 'Ada').overall.accuracy, 100)
  assert.deepEqual(original, [old, latest])
})

test('time grouping uses only supported PGN time-control facts and treats staged controls as other', () => {
  assert.deepEqual(['60', '120+1', '180', '300+5', '600', '1/86400', '40/7200:3600', '-', undefined, '0', '0+5'].map(historyTimeClass),
    ['Bullet', 'Bullet', 'Blitz', 'Blitz', 'Rapid', 'Daily', 'Unspecified / other', 'Unspecified / other', 'Unspecified / other', 'Unspecified / other', 'Blitz'])
  const a = fixture('a'); const b = fixture('b', '2026.10.02')
  b.review.headers.TimeControl = '600'
  assert.deepEqual(playerHistory([a, b], 'Ada').controls.map(group => [group.label, group.score.games]), [['Blitz', 1], ['Rapid', 1]])
})

test('empty, invalid-score, and self-play samples do not invent accuracy or double-count games', () => {
  const entry = fixture('empty')
  entry.review.black = 'ADA'
  entry.review.result = '1-0'
  entry.review.moves.forEach(move => { move.accuracy = NaN })
  assert.deepEqual(playerHistory([entry], 'Ada').overall, { accuracy: null, moves: 0, games: 0 })
  assert.equal(playerHistory([entry], 'Ada').games, 1)
  assert.equal(playerHistory([entry], 'Ada').unfinished, 1)
  assert.deepEqual(playersInHistory([entry]), ['ADA'])
  assert.deepEqual(playerHistory([], 'Ada').categories.map(category => category.score.accuracy), [null, null, null, null])
})

test('player history isolates the newest accuracy model across every statistic while retaining all saved rows', () => {
  const legacy = fixture('legacy', '2026.10.24', 0)
  legacy.review.result = '1-0'
  legacy.review.headers.TimeControl = '60'
  const current = [fixture('a', '2026.10.01', 20), fixture('b', '2026.10.02', 40), fixture('c', '2026.10.03', 60), fixture('d', '2026.10.04', 80)]
  current.forEach(entry => { entry.review.accuracyVersion = 2 })
  current[0].review.result = '1-0'
  current[1].review.result = '0-1'
  current[2].review.result = '1/2-1/2'
  const entries = [legacy, ...current]
  const summary = playerHistory(entries, 'Ada')
  assert.equal(summary.accuracyVersion, 2)
  assert.equal(summary.modelLabel, 'Win-chance accuracy (v2)')
  assert.equal(summary.excludedReviews, 1)
  assert.deepEqual(summary.overall, { accuracy: 50, moves: 8, games: 4 })
  assert.deepEqual([summary.games, summary.wins, summary.losses, summary.draws, summary.unfinished], [4, 1, 1, 1, 1])
  assert.deepEqual(summary.categories.find(category => category.label === 'Opening')?.score, summary.overall)
  assert.deepEqual(summary.controls.map(category => category.label), ['Blitz'])
  assert.equal(summary.trend?.delta, 40)
  assert.equal(sortedSavedReviews(entries).length, 5)
  assert.equal(sortedSavedReviews(entries)[0], legacy)
})

test('a newer model for another player does not change a legacy player cohort, and mixed models never fill a trend window', () => {
  const legacy = [fixture('old-a', '2026.10.01', 0), fixture('old-b', '2026.10.02', 0)]
  const newer = [fixture('new-a', '2026.10.03', 100), fixture('new-b', '2026.10.04', 100)]
  newer.forEach(entry => { entry.review.accuracyVersion = 2 })
  const summary = playerHistory([...legacy, ...newer], 'Ada')
  assert.equal(summary.games, 2)
  assert.equal(summary.excludedReviews, 2)
  assert.equal(summary.overall.accuracy, 100)
  assert.equal(summary.trend, null)
  newer.forEach(entry => { entry.review.white = 'Other'; entry.review.black = 'Another' })
  const oldPlayer = playerHistory([...legacy, ...newer], 'Ada')
  assert.equal(oldPlayer.accuracyVersion, 1)
  assert.equal(oldPlayer.excludedReviews, 0)
  assert.equal(oldPlayer.modelLabel, 'Legacy centipawn accuracy (v1)')
  assert.equal(oldPlayer.games, 2)
})

test('time-control statistics keep Chess960 separate without relabeling standard legacy games', () => {
  const standard = fixture('standard')
  const chess960 = fixture('960')
  chess960.review.variant = 'chess960'
  const tagged960 = fixture('tagged-960', '2026.10.02')
  tagged960.review.variant = undefined
  tagged960.review.headers.Variant = 'Chess960'
  const entries = [standard, chess960, tagged960]
  assert.deepEqual(playerHistory(entries, 'Ada').controls.map(category => [category.label, category.score.games]), [['Blitz', 1]])
  assert.deepEqual(playerHistory(entries, 'Ada', 'chess960').controls.map(category => [category.label, category.score.games]), [['Blitz · Chess960', 2]])
})

test('statistics prefer a local report over a newer imported copy of the same PGN and model without hiding either saved row', () => {
  const local = fixture('api-game', '2026.10.01', 75)
  const imported = structuredClone(local)
  imported.id = 'imported-game'
  imported.review.importedAt = '2026-10-24T15:00:00Z'
  imported.review.analyzedAt = '2027-01-01T00:00:00Z'
  imported.review.moves.forEach(move => { if (move.color === 'w') move.accuracy = 10 })
  const entries = [imported, local]
  const summary = playerHistory(entries, 'Ada')
  assert.deepEqual(summary.overall, { accuracy: 75, moves: 2, games: 1 })
  assert.equal(summary.excludedDuplicates, 1)
  assert.equal(summary.excludedReviews, 0)
  assert.equal(summary.games, 1)
  assert.equal(sortedSavedReviews(entries).length, 2)
})

test('newer accuracy models outrank local provenance and older-model exclusions never include duplicate copies', () => {
  const local = fixture('local-old', '2026.10.01', 10)
  const imported = structuredClone(local)
  imported.id = 'imported-new'
  imported.review.accuracyVersion = 2
  imported.review.importedAt = '2026-10-24T15:00:00Z'
  imported.review.moves.forEach(move => { if (move.color === 'w') move.accuracy = 90 })
  const otherLegacyGame = fixture('other-game', '2026.10.02', 0)
  const summary = playerHistory([local, imported, otherLegacyGame], 'Ada')
  assert.equal(summary.accuracyVersion, 2)
  assert.equal(summary.overall.accuracy, 90)
  assert.equal(summary.excludedDuplicates, 1)
  assert.equal(summary.excludedReviews, 1)
  assert.equal(summary.games, 1)
})

test('latest valid analysis date breaks ties only after model and provenance, while variant keeps games distinct', () => {
  const early = fixture('early', '2026.10.01', 20)
  early.review.analyzedAt = '2026-10-01T00:00:00Z'
  const later = fixture('later', '2026.10.01', 85)
  assert.equal(playerHistory([early, later], 'Ada').overall.accuracy, 85)
  early.review.importedAt = '2026-10-24T15:00:00Z'
  later.review.importedAt = '2026-10-24T15:00:00Z'
  assert.equal(playerHistory([early, later], 'Ada').overall.accuracy, 85)
  early.review.analyzedAt = 'invalid'
  assert.equal(playerHistory([early, later], 'Ada').overall.accuracy, 85)
  const differentVariant = structuredClone(later)
  differentVariant.id = '960'
  differentVariant.review.variant = 'chess960'
  const summary = playerHistory([later, differentVariant], 'Ada')
  assert.equal(summary.games, 1)
  assert.equal(summary.excludedDuplicates, 0)
  assert.equal(playerHistory([later, differentVariant], 'Ada', 'chess960').games, 1)
})

test('importing two duplicate reports cannot create a four-game trend or inflate category samples', () => {
  const games = [fixture('first', '2026.10.01', 40), fixture('second', '2026.10.02', 80)]
  const copies = structuredClone(games).map(entry => ({ id: `imported-${entry.id}`, review: { ...entry.review, importedAt: '2026-10-24T15:00:00Z' } }))
  const summary = playerHistory([...games, ...copies], 'Ada')
  assert.equal(summary.excludedDuplicates, 2)
  assert.equal(summary.trend, null)
  assert.deepEqual(summary.overall, { accuracy: 60, moves: 4, games: 2 })
  assert.deepEqual(summary.categories.find(category => category.label === 'Opening')?.score, summary.overall)
  assert.equal(summary.controls[0].score.games, 2)
})

test('explicit rules pools keep three-check heuristics separate from standard accuracy', async () => {
  const { reviewFixture } = await import('../test/review-fixture')
  const { variantsForPlayer } = await import('./history')
  const standard = reviewFixture()
  const three = reviewFixture('[White "Ada"]\n[Black "Grace"]\n[Variant "3-check"]\n\n1. e4 e5 2. Nf3 Nc6 *')
  three.moves.forEach(move => { move.accuracy = 0 })
  const entries = [{ id: 'standard', review: standard }, { id: 'threecheck', review: three }]
  assert.deepEqual(variantsForPlayer(entries, 'Ada'), ['chess', 'threecheck'])
  assert.equal(playerHistory(entries, 'Ada', 'chess').overall.accuracy, 100)
  const summary = playerHistory(entries, 'Ada', 'threecheck')
  assert.equal(summary.overall.accuracy, 0)
  assert.equal(summary.games, 1)
  assert.match(summary.modelLabel, /Three-check quality heuristic/)
  assert.equal(sortedSavedReviews(entries).length, 2)
})

test('King of the Hill reports have their own uncalibrated history pool', async () => {
  const { reviewFixture } = await import('../test/review-fixture')
  const { variantsForPlayer } = await import('./history')
  const hill = reviewFixture('[White "Ada"]\n[Black "Grace"]\n[Variant "King of the Hill"]\n\n1. e4 e5 2. Nf3 Nc6 *')
  hill.variant = 'kingofthehill'
  hill.moves.forEach(move => { move.accuracy = 25 })
  const entries = [{ id: 'hill', review: hill }]
  assert.deepEqual(variantsForPlayer(entries, 'Ada'), ['kingofthehill'])
  const summary = playerHistory(entries, 'Ada', 'kingofthehill')
  assert.equal(summary.overall.accuracy, 25)
  assert.equal(summary.games, 1)
  assert.match(summary.modelLabel, /King of the Hill quality heuristic/)
})

test('Atomic reports use a separate uncalibrated history pool', async () => {
  const { reviewFixture } = await import('../test/review-fixture')
  const { variantsForPlayer } = await import('./history')
  const atomic = reviewFixture('[White "Ada"]\n[Black "Grace"]\n[Variant "Atomic"]\n\n1. e4 e5 2. Nf3 Nc6 *')
  atomic.variant = 'atomic'
  atomic.moves.forEach(move => { move.accuracy = 25 })
  const entries = [{ id: 'atomic', review: atomic }]
  assert.deepEqual(variantsForPlayer(entries, 'Ada'), ['atomic'])
  const summary = playerHistory(entries, 'Ada', 'atomic')
  assert.equal(summary.overall.accuracy, 25)
  assert.equal(summary.games, 1)
  assert.match(summary.modelLabel, /Atomic quality heuristic/)
})

test('Horde reports use their own uncalibrated history pool', async () => {
  const { reviewFixture } = await import('../test/review-fixture')
  const { variantsForPlayer } = await import('./history')
  const horde = reviewFixture('[White "Ada"]\n[Black "Grace"]\n[Variant "Horde"]\n[SetUp "1"]\n[FEN "r3k3/8/8/8/8/8/P7/8 b - - 0 1"]\n[Result "0-1"]\n\n1... Rxa2 0-1')
  horde.variant = 'horde'
  horde.moves.forEach(move => { move.accuracy = 25 })
  const entries = [{ id: 'horde', review: horde }]
  assert.deepEqual(variantsForPlayer(entries, 'Grace'), ['horde'])
  const summary = playerHistory(entries, 'Grace', 'horde')
  assert.equal(summary.overall.accuracy, 25)
  assert.equal(summary.games, 1)
  assert.match(summary.modelLabel, /Horde quality heuristic/)
})

test('Crazyhouse reports use their own uncalibrated history pool', async () => {
  const { reviewFixture } = await import('../test/review-fixture')
  const { variantsForPlayer } = await import('./history')
  const crazyhouse = reviewFixture('[White "Ada"]\n[Black "Grace"]\n[Variant "Crazyhouse"]\n\n1. e4 *')
  crazyhouse.variant = 'crazyhouse'
  crazyhouse.moves.forEach(move => { move.accuracy = 25 })
  const entries = [{ id: 'crazyhouse', review: crazyhouse }]
  assert.deepEqual(variantsForPlayer(entries, 'Ada'), ['crazyhouse'])
  const summary = playerHistory(entries, 'Ada', 'crazyhouse')
  assert.equal(summary.overall.accuracy, 25)
  assert.equal(summary.games, 1)
  assert.match(summary.modelLabel, /Crazyhouse quality heuristic/)
})

test('Giveaway reports use their own uncalibrated history pool', async () => {
  const { reviewFixture } = await import('../test/review-fixture')
  const { variantsForPlayer } = await import('./history')
  const giveaway = reviewFixture('[White "Ada"]\n[Black "Grace"]\n[Variant "Giveaway"]\n\n1. e3 *')
  giveaway.variant = 'giveaway'
  giveaway.moves.forEach(move => { move.accuracy = 25 })
  const entries = [{ id: 'giveaway', review: giveaway }]
  assert.deepEqual(variantsForPlayer(entries, 'Ada'), ['giveaway'])
  const summary = playerHistory(entries, 'Ada', 'giveaway')
  assert.equal(summary.overall.accuracy, 25)
  assert.equal(summary.games, 1)
  assert.match(summary.modelLabel, /Giveaway quality heuristic/)
})
