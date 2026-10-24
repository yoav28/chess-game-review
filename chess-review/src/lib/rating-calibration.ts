import type { RatingObservation } from './rating-features'

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const quantile = (values: number[], probability: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.max(0, Math.ceil((values.length + 1) * probability) - 1))]

export function ratingPlayerFold(playerId: string): 'train' | 'calibration' | 'test' {
  let value = 2166136261
  for (const character of `rating-pilot-v1:${playerId}`) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  const fold = (value >>> 0) % 5
  return fold === 0 ? 'test' : fold === 1 ? 'calibration' : 'train'
}

export function splitRatingObservations(observations: RatingObservation[]) {
  return {
    train: observations.filter(row => ratingPlayerFold(row.playerId) === 'train' && ratingPlayerFold(row.opponentId) === 'train'),
    calibration: observations.filter(row => ratingPlayerFold(row.playerId) === 'calibration' && ratingPlayerFold(row.opponentId) !== 'test'),
    test: observations.filter(row => ratingPlayerFold(row.playerId) === 'test'),
  }
}

export function fitRatingNeighbors(training: RatingObservation[]) {
  if (training.length < 2) throw new Error('At least two training observations are required.')
  const width = training[0].values.length
  if (!width || training.some(row => row.values.length !== width || row.values.some(value => !Number.isFinite(value)) || !Number.isFinite(row.recordedRating))) throw new Error('Invalid rating observations.')
  const center = Array.from({ length: width }, (_, index) => mean(training.map(row => row.values[index])))
  const scale = center.map((value, index) => Math.sqrt(mean(training.map(row => (row.values[index] - value) ** 2))) || 1)
  const k = Math.min(training.length, Math.max(10, Math.min(30, Math.ceil(Math.sqrt(training.length)))))
  const predict = (features: number[]) => {
    if (features.length !== width || features.some(value => !Number.isFinite(value))) throw new Error('Invalid rating features.')
    const neighbors = training.map(row => ({ row, distance: Math.sqrt(features.reduce((total, value, index) => total + ((value - row.values[index]) / scale[index]) ** 2, 0)) }))
      .sort((left, right) => left.distance - right.distance || left.row.gameId.localeCompare(right.row.gameId)).slice(0, k)
    return { estimate: mean(neighbors.map(neighbor => neighbor.row.recordedRating)), neighborDistance: mean(neighbors.map(neighbor => neighbor.distance)) }
  }
  return { predict, center, scale, k }
}

export function validateRatingPilot(observations: RatingObservation[]) {
  if (new Set(observations.map(row => `${row.timeClass}:${row.profile}`)).size > 1) throw new Error('Rating calibration requires one time-control pool and engine profile.')
  if (observations.some(row => !Number.isFinite(row.recordedRating) || row.recordedRating <= 0 || !row.playerId || !row.opponentId || row.playerId === row.opponentId || !row.values.length || row.values.some(value => !Number.isFinite(value)))) throw new Error('Invalid rating observations.')
  if (new Set(observations.map(row => `${row.gameId}:${row.playerId}`)).size !== observations.length) throw new Error('Duplicate game/player rating observations.')
  const partitions = splitRatingObservations(observations)
  const counts = Object.fromEntries(Object.entries(partitions).map(([key, rows]) => [key, { observations: rows.length, players: new Set(rows.map(row => row.playerId)).size, games: new Set(rows.map(row => row.gameId)).size }]))
  if (partitions.train.length < 2 || !partitions.calibration.length || !partitions.test.length) return { available: false, reason: 'Insufficient player-separated training, calibration or test observations.', counts }
  const model = fitRatingNeighbors(partitions.train)
  const baseline = quantile(partitions.train.map(row => row.recordedRating), 0.5)
  const residuals = partitions.calibration.map(row => Math.abs(model.predict(row.values).estimate - row.recordedRating))
  const radius = quantile(residuals, 0.9)
  const tests = partitions.test.map(row => {
    const prediction = model.predict(row.values)
    return { recorded: row.recordedRating, prediction: prediction.estimate, error: Math.abs(prediction.estimate - row.recordedRating), baselineError: Math.abs(baseline - row.recordedRating), covered: Math.abs(prediction.estimate - row.recordedRating) <= radius }
  })
  const mae = mean(tests.map(row => row.error))
  const baselineMae = mean(tests.map(row => row.baselineError))
  const coverage = mean(tests.map(row => Number(row.covered)))
  const bands = Array.from({ length: 9 }, (_, index) => {
    const lower = index * 400
    const upper = lower + 399
    const selected = tests.filter(row => row.recorded >= lower && row.recorded <= upper)
    return { lower, upper, observations: selected.length, mae: selected.length ? mean(selected.map(row => row.error)) : null }
  })
  const reasons: string[] = []
  if (counts.train.players < 100 || counts.calibration.players < 30 || counts.test.players < 30) reasons.push('Too few independent players for broad calibration.')
  if (partitions.train.length < 200 || partitions.calibration.length < 50 || partitions.test.length < 50) reasons.push('Too few observations for calibration and held-out validation.')
  if (mae >= baselineMae * 0.9) reasons.push('The estimator does not improve the held-out median-rating baseline by at least 10%.')
  if (mae > 250) reasons.push('Held-out mean absolute error exceeds 250 rating points.')
  if (coverage < 0.85) reasons.push('The empirical 90% interval covers fewer than 85% of held-out observations.')
  if (radius > 500) reasons.push('The empirical uncertainty interval is wider than ±500 rating points.')
  if (bands.filter(band => band.observations >= 10).length < 4) reasons.push('Too few held-out observations across distinct rating bands.')
  return {
    available: reasons.length === 0, reasons, counts, profile: observations[0]?.profile, timeClass: observations[0]?.timeClass,
    trainingRatingRange: [Math.min(...partitions.train.map(row => row.recordedRating)), Math.max(...partitions.train.map(row => row.recordedRating))],
    validation: { mae, baselineMae, baselineRating: baseline, intervalTarget: 0.9, intervalRadius: radius, coverage, bands },
    model: { kind: 'standardized-uniform-knn', k: model.k, features: model.center.length, target: 'Recorded Chess.com blitz rating, not ground-truth single-game performance' },
  }
}
