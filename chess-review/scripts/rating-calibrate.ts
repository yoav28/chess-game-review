import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cpus } from 'node:os'
import { reviewGame } from '../src/lib/review'
import { ratingAnalysisProfile, ratingFeatures, ratingFeatureNames, ratingProfileId, type RatingObservation } from '../src/lib/rating-features'
import { validateRatingPilot } from '../src/lib/rating-calibration'
import { installRatingEngine, ratingEngineFile } from './rating-engine'

const directory = resolve(process.argv[2] ?? '/tmp/open-file-rating-pilot')
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const playerId = (username: string) => digest(username.toLowerCase())
const games = JSON.parse(await readFile(`${directory}/games.json`, 'utf8')) as { url: string; pgn: string; time_class: string; white: { username: string; rating: number }; black: { username: string; rating: number } }[]
await mkdir(`${directory}/analysis`, { recursive: true })
installRatingEngine()
const observations: RatingObservation[] = []
const failures: { url: string; error: string }[] = []
let cached = 0
const depthHistogram = new Map<number, number>()
for (const [index, game] of games.entries()) {
  try {
    const path = `${directory}/analysis/${digest(`${ratingProfileId}:${game.pgn}`)}.json`
    let review
    try { review = JSON.parse(await readFile(path, 'utf8')); cached += 1 }
    catch {
      review = await reviewGame(game.pgn, { depth: ratingAnalysisProfile.depth, timeMs: ratingAnalysisProfile.timeMs, variant: 'chess' })
      await writeFile(path, JSON.stringify(review))
    }
    for (const depth of [review.initialAnalysis.depth, ...review.moves.map((move: { depth: number }) => move.depth)]) depthHistogram.set(depth, (depthHistogram.get(depth) ?? 0) + 1)
    for (const color of ['w', 'b'] as const) {
      const features = ratingFeatures(review, color)
      if (!features) continue
      const player = color === 'w' ? game.white : game.black
      const opponent = color === 'w' ? game.black : game.white
      observations.push({ ...features, gameId: game.url, playerId: playerId(player.username), opponentId: playerId(opponent.username), recordedRating: player.rating, timeClass: game.time_class, profile: ratingProfileId })
    }
  } catch (error) { failures.push({ url: game.url, error: error instanceof Error ? error.message : String(error) }) }
  process.stdout.write(JSON.stringify({ analyzed: index + 1, total: games.length, observations: observations.length, failures: failures.length, cached }) + '\n')
  await writeFile(`${directory}/observations.json`, JSON.stringify(observations))
}
const validation = validateRatingPilot(observations)
const report = {
  schema: 1, generatedAt: new Date().toISOString(), analysisProfile: ratingAnalysisProfile, profileId: ratingProfileId,
  engineSha256: digest(await readFile(ratingEngineFile)), inputManifestSha256: digest(await readFile(`${directory}/manifest.json`)),
  engineWasmSha256: digest(await readFile(ratingEngineFile.replace(/\.js$/, '.wasm'))),
  runtime: { node: process.version, platform: process.platform, architecture: process.arch, cpu: cpus()[0]?.model },
  scoringSourceSha256: digest(await readFile(new URL('../src/lib/accuracy.ts', import.meta.url))),
  featureSourceSha256: digest(await readFile(new URL('../src/lib/rating-features.ts', import.meta.url))),
  calibrationSourceSha256: digest(await readFile(new URL('../src/lib/rating-calibration.ts', import.meta.url))),
  openingDataSha256: digest(await readFile(new URL('../src/data/openings/lichess.json', import.meta.url))),
  actualDepthHistogram: Object.fromEntries([...depthHistogram.entries()].sort((left, right) => left[0] - right[0])),
  observationsSha256: digest(JSON.stringify(observations)), games: games.length, observations: observations.length, cached, failures,
  featureNames: ratingFeatureNames, validation,
  interpretation: 'Predicts recorded Chess.com blitz rating from move-quality similarity. Player rating is not ground-truth single-game performance. No Chess.com proprietary formula is inferred.',
  split: 'Player-hash folds 60/20/20. Train rows require both players in the train fold; calibration rows require a calibration player and no test opponent; test rows require a test player. No game can occur in two partitions.',
  limits: ['Pilot selection is one country inventory and one month', 'Blitz standard chess only', 'Features require 12 non-book unforced post-opening decisions and eight contested decisions', 'Engine profile is fixed; production reports with other budgets are unsupported', 'Repeated player observations are correlated; empirical interval coverage is not a formal population guarantee', 'Validation gates are prespecified engineering acceptance criteria, not a source-product calibration'],
}
await writeFile(`${directory}/validation.json`, JSON.stringify(report, null, 2))
if (process.argv[3]) {
  const sourceManifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'))
  const sourceGames = games.map(game => ({ url: game.url, pgnSha256: digest(game.pgn), whiteRecordedRating: game.white.rating, blackRecordedRating: game.black.rating, timeClass: game.time_class }))
  await writeFile(resolve(process.argv[3]), JSON.stringify({ schema: 1, report, sourceManifest, sourceGames, observations }))
}
process.stdout.write(JSON.stringify({ complete: true, directory, validation }, null, 2) + '\n')
