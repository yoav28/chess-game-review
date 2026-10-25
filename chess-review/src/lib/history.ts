import type { Color } from 'chess.js'
import type { GameReview, MoveReview } from './review'
import type { SavedReview } from './storage'
import { isVariantHeuristic, variantLabel, type ChessVariant } from './variants'

export type HistoryScore = { accuracy: number | null; moves: number; games: number }
export type ReviewDate = { timestamp: number | null; source: 'game' | 'review' | 'unknown' }
export type HistoryCategory = { label: string; score: HistoryScore }
export type PlayerHistory = {
  player: string
  accuracyVersion: number
  modelLabel: string
  excludedReviews: number
  excludedDuplicates: number
  games: number
  wins: number
  draws: number
  losses: number
  unfinished: number
  overall: HistoryScore
  categories: HistoryCategory[]
  controls: HistoryCategory[]
  trend: { recent: HistoryScore; earlier: HistoryScore; delta: number } | null
}

export const historyMethod = 'Saved reviews on this browser only. Statistics count each exact PGN and variant once, preferring the newest accuracy model, then a locally generated report over an imported report, then the latest analysis date. Duplicate rows remain reopenable. Player statistics use that player’s newest available accuracy model; legacy centipawn scores are never pooled with win-chance scores. Accuracy pools actual move scores, with move and game sample counts. Opening and Endgame use recorded phases; Tactics includes captures, checks, and promotions; Strategy includes quiet middlegame moves. Categories can overlap. The interface selects one rules pool before computing statistics. Time groups estimate duration as base + 40 increments and separate game variants. Three-check, King of the Hill, Atomic, Horde, Crazyhouse, Giveaway, and Racing Kings scores are uncalibrated quality heuristics, not winning probabilities. Trend compares equally sized recent and preceding groups (up to five games each), requires at least four scored games in the same model with valid PGN dates and a distinct date boundary, and uses game dates rather than review dates. Different review depths can affect comparisons. These scores are not ratings.'

const normalize = (name: string) => name.trim().toLocaleLowerCase()
const round = (value: number) => Math.round(value * 10) / 10
const validScore = (move: MoveReview) => Number.isFinite(move.accuracy) && move.accuracy >= 0 && move.accuracy <= 100

export function reviewAccuracyVersion(review: GameReview): number {
  const version = review.accuracyVersion
  return version !== undefined && Number.isInteger(version) && version >= 1 ? version : 1
}

export function accuracyModelLabel(version: number, variant?: ChessVariant): string {
  if (variant && isVariantHeuristic(variant)) return `${variantLabel(variant)} quality heuristic (v2)`
  return version === 2 ? 'Win-chance accuracy (v2)' : version === 1 ? 'Legacy centipawn accuracy (v1)' : `Accuracy model v${version}`
}

function gameDate(review: GameReview): number | null {
  for (const date of [review.headers.UTCDate, review.headers.Date]) {
    if (!/^\d{4}[.-]\d{2}[.-]\d{2}$/.test(date ?? '')) continue
    const iso = date.replace(/\./g, '-')
    const time = review.headers.UTCTime
    const clock = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time ?? '') ? time : '00:00:00'
    const timestamp = Date.parse(`${iso}T${clock}Z`)
    if (Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso) return timestamp
  }
  return null
}

export function reviewDate(review: GameReview): ReviewDate {
  const played = gameDate(review)
  if (played !== null) return { timestamp: played, source: 'game' }
  const analyzed = Date.parse(review.analyzedAt)
  return Number.isFinite(analyzed) ? { timestamp: analyzed, source: 'review' } : { timestamp: null, source: 'unknown' }
}

export function sortedSavedReviews(entries: SavedReview[]): SavedReview[] {
  const unique = new Map<string, SavedReview>()
  for (const entry of entries) {
    const previous = unique.get(entry.id)
    const currentDate = Date.parse(entry.review.analyzedAt)
    const previousDate = previous ? Date.parse(previous.review.analyzedAt) : NaN
    if (!previous || Number.isFinite(currentDate) && (!Number.isFinite(previousDate) || currentDate > previousDate)) unique.set(entry.id, entry)
  }
  return [...unique.values()].sort((a, b) => {
    const left = reviewDate(a.review).timestamp
    const right = reviewDate(b.review).timestamp
    if (left === null) return right === null ? a.id.localeCompare(b.id) : 1
    if (right === null) return -1
    return right - left || a.id.localeCompare(b.id)
  })
}

export function playersInHistory(entries: SavedReview[]): string[] {
  const players = new Map<string, string>()
  for (const { review } of sortedSavedReviews(entries)) {
    for (const name of [review.white, review.black]) if (name.trim()) players.set(normalize(name), name.trim())
  }
  return [...players.values()].sort((a, b) => a.localeCompare(b))
}

export function historyTimeClass(control?: string): string {
  if (/^1\/\d+$/.test(control ?? '')) return 'Daily'
  const match = control?.match(/^(\d+)(?:\+(\d+))?$/)
  if (!match) return 'Unspecified / other'
  const seconds = Number(match[1]) + 40 * Number(match[2] ?? 0)
  if (seconds <= 0) return 'Unspecified / other'
  return seconds < 180 ? 'Bullet' : seconds < 600 ? 'Blitz' : 'Rapid'
}

export const reviewVariant = (review: GameReview): ChessVariant => review.variant ?? (/^(?:3-?check|Three-?check|Three Check)$/i.test(review.headers.Variant ?? '') ? 'threecheck' : /^(?:King of the Hill|KingOfTheHill|KOTH)$/i.test(review.headers.Variant ?? '') ? 'kingofthehill' : /^Atomic$/i.test(review.headers.Variant ?? '') ? 'atomic' : /^Horde$/i.test(review.headers.Variant ?? '') ? 'horde' : /^Crazyhouse$/i.test(review.headers.Variant ?? '') ? 'crazyhouse' : /^Giveaway$/i.test(review.headers.Variant ?? '') ? 'giveaway' : /^(?:Racing Kings|RacingKings)$/i.test(review.headers.Variant ?? '') ? 'racingkings' : /^(?:Chess960|Fischerandom|Fischer Random|Freestyle)$/i.test(review.headers.Variant ?? '') ? 'chess960' : 'chess')
const timeGroup = (review: GameReview) => `${historyTimeClass(review.headers.TimeControl)}${reviewVariant(review) !== 'chess' ? ` · ${variantLabel(reviewVariant(review))}` : ''}`

export function variantsForPlayer(entries: SavedReview[], playerName: string): ChessVariant[] {
  const player = normalize(playerName)
  return (['chess', 'chess960', 'threecheck', 'kingofthehill', 'atomic', 'horde', 'crazyhouse', 'giveaway', 'racingkings'] as ChessVariant[]).filter(variant => entries.some(({ review }) => reviewVariant(review) === variant && [normalize(review.white), normalize(review.black)].includes(player)))
}

function uniqueStatisticReviews(entries: SavedReview[]): SavedReview[] {
  const unique = new Map<string, SavedReview>()
  for (const entry of entries) {
    const key = `${reviewVariant(entry.review)}\u0000${entry.review.pgn}`
    const previous = unique.get(key)
    if (!previous) { unique.set(key, entry); continue }
    const versionDifference = reviewAccuracyVersion(entry.review) - reviewAccuracyVersion(previous.review)
    const localDifference = Number(entry.review.importedAt === undefined) - Number(previous.review.importedAt === undefined)
    const timestamp = Date.parse(entry.review.analyzedAt)
    const previousTimestamp = Date.parse(previous.review.analyzedAt)
    if (versionDifference > 0 || versionDifference === 0 && (localDifference > 0
      || localDifference === 0 && Number.isFinite(timestamp) && (!Number.isFinite(previousTimestamp) || timestamp > previousTimestamp))) unique.set(key, entry)
  }
  return [...unique.values()]
}

function playerMoves(review: GameReview, player: string): MoveReview[] {
  const colors: Color[] = []
  if (normalize(review.white) === player) colors.push('w')
  if (normalize(review.black) === player) colors.push('b')
  return review.moves.filter(move => colors.includes(move.color) && validScore(move))
}

function score(groups: MoveReview[][]): HistoryScore {
  const moves = groups.flat()
  return { accuracy: moves.length ? round(moves.reduce((sum, move) => sum + move.accuracy, 0) / moves.length) : null, moves: moves.length, games: groups.filter(group => group.length).length }
}

export function playerHistory(entries: SavedReview[], playerName: string, variant?: ChessVariant): PlayerHistory {
  const player = normalize(playerName)
  const selectedVariant = variant ?? variantsForPlayer(entries, playerName)[0] ?? 'chess'
  const allGames = sortedSavedReviews(entries).filter(({ review }) => [normalize(review.white), normalize(review.black)].includes(player) && reviewVariant(review) === selectedVariant)
  const distinctGames = uniqueStatisticReviews(allGames)
  const accuracyVersion = distinctGames.reduce((latest, { review }) => Math.max(latest, reviewAccuracyVersion(review)), 1)
  const games = distinctGames.filter(({ review }) => reviewAccuracyVersion(review) === accuracyVersion)
  const groups = games.map(({ review }) => playerMoves(review, player))
  const result = { wins: 0, draws: 0, losses: 0, unfinished: 0 }
  for (const { review } of games) {
    if (review.result === '1/2-1/2') result.draws++
    else if (!['1-0', '0-1'].includes(review.result) || normalize(review.white) === normalize(review.black)) result.unfinished++
    else if ((normalize(review.white) === player) === (review.result === '1-0')) result.wins++
    else result.losses++
  }
  const forcing = (move: MoveReview) => Boolean(move.captured || move.promotion || /[+#]$/.test(move.san))
  const categories = [
    { label: 'Opening', include: (move: MoveReview) => move.phase === 'opening' },
    { label: 'Tactics', include: forcing },
    { label: 'Strategy', include: (move: MoveReview) => move.phase === 'middlegame' && !forcing(move) },
    { label: 'Endgame', include: (move: MoveReview) => move.phase === 'endgame' },
  ].map(({ label, include }) => ({ label, score: score(groups.map(group => group.filter(include))) }))
  const controls = [...new Set(games.map(({ review }) => timeGroup(review)))].sort()
    .map(label => ({ label, score: score(games.flatMap(({ review }, index) => timeGroup(review) === label ? [groups[index]] : [])) }))
  const dated = games.filter(({ review }) => gameDate(review) !== null && playerMoves(review, player).length)
    .sort((a, b) => gameDate(b.review)! - gameDate(a.review)! || a.id.localeCompare(b.id))
  let trend: PlayerHistory['trend'] = null
  if (dated.length >= 4) {
    const window = Math.min(5, Math.floor(dated.length / 2))
    if (gameDate(dated[window - 1].review)! > gameDate(dated[window].review)!) {
      const recent = score(dated.slice(0, window).map(({ review }) => playerMoves(review, player)))
      const earlier = score(dated.slice(window, 2 * window).map(({ review }) => playerMoves(review, player)))
      trend = { recent, earlier, delta: round(recent.accuracy! - earlier.accuracy!) }
    }
  }
  return { player: playerName.trim(), accuracyVersion, modelLabel: accuracyModelLabel(accuracyVersion, selectedVariant), excludedReviews: distinctGames.length - games.length,
    excludedDuplicates: allGames.length - distinctGames.length, games: games.length, ...result, overall: score(groups), categories, controls, trend }
}
