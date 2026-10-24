import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parsePgn } from '../src/lib/game'
import { ratingPlayerFold } from '../src/lib/rating-calibration'

type Player = { username: string; rating: number }
type Game = { url: string; pgn: string; rated: boolean; rules: string; time_class: string; white: Player; black: Player; sourceArchive?: string }
type Source = { url: string; retrievedAt: string; status: number; sha256: string }
type Ledger = { attempts: number; planSha256: string; expandedPlayers: string[]; fetches: { url: string; at: string; status?: number; error?: string }[] }
const directory = resolve(process.argv[2] ?? '/tmp/open-file-rating-v2')
const artifactPath = resolve(process.argv[3] ?? 'src/data/rating-stratified-v2-cohort.json')
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const playerId = (name: string) => digest(name.toLowerCase())
const rank = (value: string) => digest(`rating-stratified-v2:${value.toLowerCase()}`)
const band = (rating: number) => rating >= 400 && rating < 2800 ? Math.floor((rating - 400) / 400) : -1
const names = (game: Game) => [game.white.username.toLowerCase(), game.black.username.toLowerCase()]
const plan = (await readFile(new URL('../../docs/rating-validation-v2.md', import.meta.url), 'utf8')).split('\n## Cohort result')[0]
const planSha256 = digest(plan)
await mkdir(`${directory}/raw`, { recursive: true })
let ledger: Ledger
try { ledger = JSON.parse(await readFile(`${directory}/ledger.json`, 'utf8')) }
catch { ledger = { attempts: 0, planSha256, expandedPlayers: [], fetches: [] } }
assert.equal(ledger.planSha256, planSha256, 'The frozen sampling plan changed.')
async function saveLedger() { await writeFile(`${directory}/ledger.tmp`, JSON.stringify(ledger)); await rename(`${directory}/ledger.tmp`, `${directory}/ledger.json`) }
const sources: Source[] = []
async function get(url: string): Promise<unknown> {
  const path = `${directory}/raw/${digest(url)}.json`
  try { const cached = JSON.parse(await readFile(path, 'utf8')); sources.push(cached.provenance); return cached.provenance.status === 200 ? cached.data : null } catch {}
  for (let retry = 0; retry < 3; retry += 1) {
    if (ledger.attempts >= 250) return null
    ledger.attempts += 1
    const entry = { url, at: new Date().toISOString() } as Ledger['fetches'][number]
    ledger.fetches.push(entry)
    await saveLedger()
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } })
      entry.status = response.status
      await saveLedger()
      if ((response.status === 429 || response.status >= 500) && retry < 2) {
        const delay = Number(response.headers.get('Retry-After')) || 2 ** retry
        if (delay <= 60) { await new Promise(resolve => setTimeout(resolve, delay * 1000)); continue }
      }
      const text = await response.text()
      const data = JSON.parse(text)
      const provenance = { url, retrievedAt: new Date().toISOString(), status: response.status, sha256: digest(text) }
      await writeFile(path, JSON.stringify({ provenance, data }))
      sources.push(provenance)
      return response.ok ? data : null
    } catch (error) { entry.error = error instanceof Error ? error.message : String(error); await saveLedger() }
  }
  return null
}

const previous = JSON.parse(await readFile(new URL('../src/data/rating-pilot-v1.json', import.meta.url), 'utf8'))
const priorPlayers = new Set<string>(previous.observations.flatMap((row: { playerId: string; opponentId: string }) => [row.playerId, row.opponentId]))
for (const row of previous.sourceManifest.playerCounts) priorPlayers.add(playerId(row.player))
let supplementalPriorCache = false
try {
  const priorGames = JSON.parse(await readFile('/tmp/open-file-rating-pilot/games.json', 'utf8')) as Game[]
  for (const game of priorGames) names(game).forEach(name => priorPlayers.add(playerId(name)))
  supplementalPriorCache = true
} catch {}
const streamers = await get('https://api.chess.com/pub/streamers') as { streamers?: { username: string }[] } | null
const leaderboards = await get('https://api.chess.com/pub/leaderboards') as Record<string, { username: string }[]> | null
if (!streamers?.streamers?.length || !leaderboards) throw new Error('Public discovery inventories are unavailable.')
const named = ['erik', 'DanielRensch', 'AnnaCramling', 'ChessNetwork'].map(name => name.toLowerCase())
const streamerSeeds = [...new Set(streamers.streamers.map(row => row.username.toLowerCase()))].sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, 56)
const leaderboardSeeds = [...new Set(Object.values(leaderboards).filter(Array.isArray).flatMap(rows => rows.map(row => row.username?.toLowerCase()).filter(Boolean)))].sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, 20)
const seeds = [...new Set([...named, ...streamerSeeds, ...leaderboardSeeds])].filter(name => /^[a-z0-9_-]{1,50}$/.test(name))
const seedSet = new Set(seeds)
const candidates = new Map<string, Game>()
const frontier = new Map<string, number[]>()
const accounts: { username: string; source: string; eligible: number; retainedCandidates: number; observedRatings: number[] }[] = []
const seenAccounts = new Set<string>()
const rejected = { invalid: 0, shortOrLong: 0, previousPlayers: 0 }

function selectGames() {
  const sorted = [...candidates.values()].sort((a, b) => rank(a.url).localeCompare(rank(b.url)))
  const chosen: Game[] = []
  const used = new Set<string>()
  const appearances = new Map<string, number>()
  const totals = Array(6).fill(0) as number[]
  let added = true
  while (chosen.length < 800 && added) {
    added = false
    for (let group = 0; group < 6 && chosen.length < 800; group += 1) {
      const game = sorted.find(game => {
        if (used.has(game.url) || names(game).some(name => (appearances.get(name) ?? 0) >= 6)) return false
        const groups = [band(game.white.rating), band(game.black.rating)]
        return groups.includes(group) && groups.filter(value => value >= 0).every(value => totals[value] + groups.filter(candidate => candidate === value).length <= 266)
      })
      if (!game) continue
      chosen.push(game); used.add(game.url); names(game).forEach(name => appearances.set(name, (appearances.get(name) ?? 0) + 1))
      for (const player of [game.white, game.black]) { const group = band(player.rating); if (group >= 0) totals[group] += 1 }
      added = true
    }
  }
  return { games: chosen, totals, appearances }
}

async function collect(username: string, source: string, discover: boolean) {
  if (seenAccounts.has(username) || !/^[a-z0-9_-]{1,50}$/.test(username)) return
  seenAccounts.add(username)
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/2026/09`
  const archive = await get(url) as { games?: Game[] } | null
  const eligible = (archive?.games ?? []).filter(game => game.rated && game.rules === 'chess' && game.time_class === 'blitz'
    && typeof game.pgn === 'string' && game.white?.rating > 0 && game.black?.rating > 0 && names(game).includes(username))
  if (discover) for (const game of eligible) for (const player of [game.white, game.black]) {
    const name = player.username.toLowerCase()
    if (!seedSet.has(name) && !priorPlayers.has(playerId(name))) frontier.set(name, [...(frontier.get(name) ?? []), player.rating])
  }
  const available = eligible.filter(game => {
    if (names(game).some(name => priorPlayers.has(playerId(name)))) { rejected.previousPlayers += 1; return false }
    return [game.white.rating, game.black.rating].some(rating => band(rating) >= 0)
  }).sort((a, b) => rank(a.url).localeCompare(rank(b.url)))
  let retained = 0
  for (const game of available) {
    if (retained >= 30) break
    try {
      const plies = parsePgn(game.pgn).moves.length
      if (plies < 50 || plies > 180) { rejected.shortOrLong += 1; continue }
      candidates.set(game.url, { ...game, sourceArchive: url }); retained += 1
    } catch { rejected.invalid += 1 }
  }
  accounts.push({ username, source, eligible: eligible.length, retainedCandidates: retained, observedRatings: [...new Set(eligible.flatMap(game => [game.white, game.black]).filter(player => player.username.toLowerCase() === username).map(player => player.rating))].sort((a, b) => a - b) })
  const selected = selectGames()
  process.stdout.write(JSON.stringify({ accounts: accounts.length, source, attempts: ledger.attempts, candidates: candidates.size, selectedGames: selected.games.length, primaryLabelsByBand: selected.totals }) + '\n')
}
for (const username of seeds) await collect(username, named.includes(username) ? 'named-public-seed' : streamerSeeds.includes(username) ? 'streamer' : 'leaderboard', true)
for (const username of ledger.expandedPlayers) await collect(username, 'one-hop-opponent', false)
while (ledger.attempts < 250) {
  const selected = selectGames()
  const pending = [...frontier.entries()].filter(([name]) => !seenAccounts.has(name))
  if (!pending.length) break
  const priority = (ratings: number[]) => {
    const median = [...ratings].sort((a, b) => a - b)[Math.floor(ratings.length / 2)]
    const group = band(median)
    return group >= 0 ? selected.totals[group] / 266 : 2
  }
  pending.sort((a, b) => priority(a[1]) - priority(b[1]) || rank(a[0]).localeCompare(rank(b[0])))
  const username = pending[0][0]
  ledger.expandedPlayers.push(username); await saveLedger()
  await collect(username, 'one-hop-opponent', false)
}
const selected = selectGames()
assert.ok(selected.games.length <= 800 && [...selected.appearances.values()].every(count => count <= 6))
assert.equal(new Set(selected.games.map(game => game.url)).size, selected.games.length)
assert.ok(selected.games.every(game => names(game).every(name => !priorPlayers.has(playerId(name)))))
const observations = selected.games.flatMap(game => [
  { gameId: game.url, playerId: playerId(game.white.username), opponentId: playerId(game.black.username), recordedRating: game.white.rating },
  { gameId: game.url, playerId: playerId(game.black.username), opponentId: playerId(game.white.username), recordedRating: game.black.rating },
])
const partition = (row: typeof observations[number]) => {
  const own = ratingPlayerFold(row.playerId); const other = ratingPlayerFold(row.opponentId)
  return own === 'train' && other === 'train' ? 'train' : own === 'calibration' && other !== 'test' ? 'calibration' : own === 'test' ? 'test' : 'excluded'
}
const summarize = (rows: typeof observations) => ({ observations: rows.length, players: new Set(rows.map(row => row.playerId)).size, games: new Set(rows.map(row => row.gameId)).size })
const counts = Object.fromEntries(['train', 'calibration', 'test'].map(fold => [fold, summarize(observations.filter(row => partition(row) === fold))]))
const byBand = Array.from({ length: 6 }, (_, group) => ({ lower: 400 + group * 400, upper: 799 + group * 400,
  labels: selected.totals[group], folds: Object.fromEntries(['train', 'calibration', 'test'].map(fold => [fold, summarize(observations.filter(row => band(row.recordedRating) === group && partition(row) === fold))])) }))
const reasons: string[] = []
for (const [fold, minimumRows, minimumPlayers] of [['train', 200, 100], ['calibration', 50, 30], ['test', 50, 30]] as const) {
  if (counts[fold].observations < minimumRows || counts[fold].players < minimumPlayers) reasons.push(`Insufficient overall ${fold} metadata support.`)
  for (const group of byBand) {
    const support = group.folds[fold]
    if (support.observations < (fold === 'train' ? 40 : 15) || support.players < (fold === 'train' ? 10 : 5)) reasons.push(`Insufficient ${fold} metadata support in ${group.lower}–${group.upper}.`)
  }
}
const manifest = { schema: 2, stage: 'pre-engine-metadata', createdAt: new Date().toISOString(), month: '2026/09', planSha256,
  frozenFeatureSha256: digest(await readFile(new URL('../src/lib/rating-features.ts', import.meta.url), 'utf8')),
  frozenCalibrationSha256: digest(await readFile(new URL('../src/lib/rating-calibration.ts', import.meta.url), 'utf8')),
  attempts: ledger.attempts, maximumAttempts: 250, games: selected.games.length, players: selected.appearances.size, maximumPlayerAppearances: Math.max(0, ...selected.appearances.values()),
  priorPlayerHashes: priorPlayers.size, supplementalPriorCache, counts, byBand, metadataGate: { passed: reasons.length === 0, reasons },
  sources: [...new Map(sources.map(source => [source.url, source])).values()], accounts, rejected, gameDatasetSha256: digest(JSON.stringify(selected.games)),
  additionalLabels: { below400: observations.filter(row => row.recordedRating < 400).length, atLeast2800: observations.filter(row => row.recordedRating >= 2800).length },
  limitations: ['Streamer and leaderboard convenience frames are not representative of all players', 'Metadata support precedes stricter engine-feature support', 'No engine analysis, fitting, held-out residual inspection, or UI rating was performed at this stage'],
}
await writeFile(`${directory}/games.json`, JSON.stringify(selected.games))
await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2))
await writeFile(artifactPath, JSON.stringify({ manifest, sourceGames: selected.games.map(game => ({ url: game.url, pgnSha256: digest(game.pgn), sourceArchive: game.sourceArchive })), observations }))
process.stdout.write(JSON.stringify({ complete: true, directory, artifactPath, games: selected.games.length, counts, byBand, metadataGate: manifest.metadataGate }, null, 2) + '\n')
