import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parsePgn } from '../src/lib/game'

const destination = resolve(process.argv[2] ?? '/tmp/open-file-rating-pilot')
const month = process.argv[3] ?? '2026/10'
if (!/^\d{4}\/\d{2}$/.test(month)) throw new Error('Archive month must be YYYY/MM.')
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const rank = (value: string) => digest(`rating-pilot-v1:${value.toLowerCase()}`)
const maximumAttempts = 100
let attempts = 0
const sources: { url: string; retrievedAt: string; sha256: string; status: number; cached: boolean }[] = []
await mkdir(`${destination}/raw`, { recursive: true })

async function get(url: string): Promise<unknown> {
  const path = `${destination}/raw/${digest(url)}.json`
  try {
    const cached = JSON.parse(await readFile(path, 'utf8'))
    sources.push({ ...cached.provenance, cached: true })
    return cached.data
  } catch {}
  for (let retry = 0; retry < 3; retry += 1) {
    if (++attempts > maximumAttempts) throw new Error('The bounded request budget is exhausted.')
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } })
    if (response.status === 429 || response.status >= 500) {
      const seconds = Number(response.headers.get('Retry-After')) || 2 ** retry
      if (retry < 2 && seconds <= 60) { await new Promise(resolve => setTimeout(resolve, seconds * 1000)); continue }
    }
    const text = await response.text()
    const provenance = { url, retrievedAt: new Date().toISOString(), sha256: digest(text), status: response.status }
    const data = JSON.parse(text)
    await writeFile(path, JSON.stringify({ provenance, data }))
    sources.push({ ...provenance, cached: false })
    if (!response.ok) return null
    return data
  }
  return null
}

type RawGame = { url: string; pgn: string; rated: boolean; rules: string; time_class: string; time_control: string; end_time: number; white: { username: string; rating: number }; black: { username: string; rating: number } }
const country = await get('https://api.chess.com/pub/country/IT/players') as { players?: string[] } | null
if (!country?.players?.length) throw new Error('No public country player inventory was returned.')
const selectedPlayers = [...country.players].sort((left, right) => rank(left).localeCompare(rank(right))).slice(0, 60)
const candidates = new Map<string, RawGame>()
const playerCounts: { player: string; source: string; available: number; selected: number }[] = []
async function collectPlayer(player: string, source: string) {
  if (!/^[a-z0-9_-]{1,50}$/i.test(player)) return
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(player.toLowerCase())}/games/${month}`
  const archive = await get(url) as { games?: RawGame[] } | null
  const eligible = (archive?.games ?? []).filter(game => game.rated && game.rules === 'chess' && game.time_class === 'blitz'
    && game.white.rating > 0 && game.black.rating > 0 && [game.white.username, game.black.username].some(name => name.toLowerCase() === player.toLowerCase()))
    .filter(game => { try { const moves = parsePgn(game.pgn).moves.length; return moves >= 50 && moves <= 180 } catch { return false } })
    .sort((left, right) => rank(left.url).localeCompare(rank(right.url)))
  const chosen = eligible.slice(0, 4)
  chosen.forEach(game => candidates.set(game.url, game))
  playerCounts.push({ player, source, available: eligible.length, selected: chosen.length })
  process.stdout.write(JSON.stringify({ sampledAccounts: playerCounts.length, selectedGames: candidates.size, attempts }) + '\n')
}
for (const player of selectedPlayers) await collectPlayer(player, 'country-hash-sample')
const initialPlayers = new Set(selectedPlayers.map(player => player.toLowerCase()))
const oneHopPlayers = [...new Set([...candidates.values()].flatMap(game => [game.white.username.toLowerCase(), game.black.username.toLowerCase()]))]
  .filter(player => !initialPlayers.has(player)).sort((left, right) => rank(left).localeCompare(rank(right))).slice(0, 39)
for (const player of oneHopPlayers) {
  if (attempts >= maximumAttempts) break
  await collectPlayer(player, 'one-hop-opponent')
}
const games = [...candidates.values()].sort((left, right) => left.url.localeCompare(right.url))
await writeFile(`${destination}/games.json`, JSON.stringify(games))
const ratings = games.flatMap(game => [game.white.rating, game.black.rating])
const manifest = {
  schema: 1, createdAt: new Date().toISOString(), month, population: 'Chess.com public Italy country inventory of 10,000 recently active accounts',
  selection: 'SHA256 ordering with salt rating-pilot-v1; first 60 country accounts, then up to39 SHA256-ordered one-hop opponents observed in selected games; at most four SHA256-ordered rated standard blitz games per account with 50–180 plies; duplicate game URLs removed',
  maximumAttempts, attempts, sourceEndpoints: sources.length, freshAttemptsThisRun: attempts, selectedAccounts: playerCounts.length, countryAccounts: selectedPlayers.length, oneHopAccounts: playerCounts.filter(row => row.source === 'one-hop-opponent').length, games: games.length, ratingRange: ratings.length ? [Math.min(...ratings), Math.max(...ratings)] : [],
  gameDatasetSha256: digest(JSON.stringify(games)), sources, playerCounts,
  primaryDocumentation: ['https://www.chess.com/news/view/published-data-api', 'https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review'],
  limitations: ['Country and recent-activity selection bias', 'Single month and blitz only', 'Recorded rating is a noisy player-level label, not observed single-game performance', 'Sample excludes short games and games longer than 180 plies'],
}
await writeFile(`${destination}/manifest.json`, JSON.stringify(manifest, null, 2))
process.stdout.write(JSON.stringify({ complete: true, destination, games: games.length, ratingRange: manifest.ratingRange, attempts }) + '\n')
