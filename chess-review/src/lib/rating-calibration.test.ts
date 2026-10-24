import test from 'node:test'
import assert from 'node:assert/strict'
import { fitRatingNeighbors, ratingPlayerFold, splitRatingObservations, validateRatingPilot } from './rating-calibration'
import { ratingFeatures, ratingProfileId, type RatingObservation } from './rating-features'
import { buildReview, parsePgn } from './review'
import { demoGame } from './demo'

const observation = (gameId: string, playerId: string, opponentId: string, recordedRating = 1200, values = [1, 2]): RatingObservation => ({
  gameId, playerId, opponentId, recordedRating, values, decisions: 20, contestedDecisions: 12, timeClass: 'blitz', profile: ratingProfileId,
})

test('player-separated partitions also exclude every shared game from training and calibration leakage', () => {
  const ids = Array.from({ length: 50 }, (_, index) => String(index))
  const train = ids.filter(id => ratingPlayerFold(id) === 'train')
  const calibration = ids.find(id => ratingPlayerFold(id) === 'calibration')!
  const heldout = ids.find(id => ratingPlayerFold(id) === 'test')!
  const rows = [
    observation('train-game', train[0], train[1]), observation('train-game', train[1], train[0]),
    observation('calibration-game', calibration, train[0]), observation('calibration-game', train[0], calibration),
    observation('test-game', heldout, train[1]), observation('test-game', train[1], heldout),
  ]
  const split = splitRatingObservations(rows)
  assert.equal(split.train.length, 2)
  assert.equal(split.calibration.length, 1)
  assert.equal(split.test.length, 1)
  const seenGames = new Set<string>()
  const seenPlayers = new Set<string>()
  for (const partition of Object.values(split)) {
    const games = new Set(partition.map(row => row.gameId))
    const players = new Set(partition.map(row => row.playerId))
    assert.ok([...games].every(game => !seenGames.has(game)))
    assert.ok([...players].every(player => !seenPlayers.has(player)))
    games.forEach(game => seenGames.add(game))
    players.forEach(player => seenPlayers.add(player))
  }
})

test('an apparently accurate tiny calibration never authorizes a production game-rating estimate', () => {
  const rows = [observation('a', '2', '3'), observation('a', '3', '2'), observation('b', '1', '2'), observation('c', '0', '2')]
  const report = validateRatingPilot(rows)
  assert.equal(report.available, false)
  assert.ok('reasons' in report && report.reasons?.some(reason => reason.includes('Too few independent players')))
})

test('calibration rejects mixed engine profiles and time pools rather than pooling unlike ratings', () => {
  const first = observation('a', '2', '3')
  assert.throws(() => validateRatingPilot([first, { ...first, timeClass: 'rapid' }]), /one time-control pool/)
  assert.throws(() => validateRatingPilot([first, { ...first, profile: 'different-budget' }]), /one time-control pool/)
  assert.throws(() => fitRatingNeighbors([first, { ...first, values: [NaN, 1] }]), /Invalid rating/)
  assert.throws(() => validateRatingPilot([first, first]), /Duplicate/)
  assert.equal(validateRatingPilot([]).available, false)
})

test('nearest neighbors predict only empirical recorded labels and never consume the query player’s rating', () => {
  const training = Array.from({ length: 40 }, (_, index) => observation(String(index), `player-${index}`, 'opponent', index < 20 ? 800 : 2000, [index < 20 ? 0 : 10, index < 20 ? 0 : 10]))
  const model = fitRatingNeighbors(training)
  assert.equal(model.predict([0, 0]).estimate, 800)
  assert.equal(model.predict([10, 10]).estimate, 2000)
  assert.throws(() => model.predict([NaN, 0]), /Invalid rating features/)
})

test('feature extraction refuses short, legacy and Chess960 reports and records decision support', () => {
  const parsed = parsePgn(demoGame.pgn)
  const review = buildReview(parsed, [parsed.initialFen, ...parsed.moves.map(move => move.afterFen)].map(fen => ({
    fen, evaluation: { cp: 0, mate: null }, bestMove: null, bestMoveSan: null, pv: [], pvSan: [], depth: 10, lines: [],
  })))
  review.moves = review.moves.map(move => ({ ...move, classification: 'good', legalMoves: 20, winningChanceLoss: move.ply % 3 ? 0 : 20, beforeEvaluation: { cp: 0, mate: null } }))
  const features = ratingFeatures(review, 'w')
  assert.ok(features)
  assert.equal(features.values.length, 7)
  assert.ok(features.decisions >= 12)
  assert.equal(features.contestedDecisions, features.decisions)
  assert.equal(ratingFeatures({ ...review, variant: 'chess960' }, 'w'), null)
  assert.equal(ratingFeatures({ ...review, accuracyVersion: undefined }, 'w'), null)
  assert.equal(ratingFeatures({ ...review, moves: review.moves.slice(0, 10) }, 'w'), null)
})
