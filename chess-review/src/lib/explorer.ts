import { Chess } from 'chess.js'
import type { GameRecord } from './game'

export interface ExplorerMove {
  uci: string
  san: string
  games: number
  whiteWins: number
  draws: number
  blackWins: number
  unknownResults: number
  averageRating: number | null
}

export interface ExplorerProgress {
  scanned: number
  total: number
  standardGames: number
  skippedGames: number
  duplicateGames: number
  matchingGames: number
}

export interface ExplorerResult extends ExplorerProgress {
  fen: string
  moves: ExplorerMove[]
}

export interface ExplorerOptions {
  signal?: AbortSignal
  onProgress?: (progress: ExplorerProgress) => void
}

const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ')
export const canonicalPosition = (fen: string): string => positionKey(new Chess(fen).fen())

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Opening exploration cancelled.', 'AbortError')
}

async function yieldToBrowser(signal?: AbortSignal) {
  checkAbort(signal)
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  checkAbort(signal)
}

function resultOf(game: GameRecord): 'whiteWins' | 'blackWins' | 'draws' | 'unknownResults' {
  const result = game.pgn.match(/^\s*\[Result\s+"([^"\r\n]+)"\]/m)?.[1]
  if (result === '1-0') return 'whiteWins'
  if (result === '0-1') return 'blackWins'
  if (result === '1/2-1/2') return 'draws'
  if (game.white.result === 'win') return 'whiteWins'
  if (game.black.result === 'win') return 'blackWins'
  const drawn = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']
  return drawn.includes(game.white.result) || drawn.includes(game.black.result) ? 'draws' : 'unknownResults'
}

function* mainline(pgn: string): Generator<string> {
  const body = pgn.replace(/^\uFEFF/, '').replace(/^\s*\[[^\r\n]*\]\s*$/gm, '').replace(/^%[^\r\n]*$/gm, '')
  let variation = 0
  for (const match of body.matchAll(/\{[^}]*\}|;[^\r\n]*|\(|\)|[^\s(){};]+/g)) {
    const token = match[0]
    if (token === '(') { variation += 1; continue }
    if (token === ')') {
      if (!variation) throw new Error('Unbalanced PGN variation.')
      variation -= 1
      continue
    }
    if (variation || token.startsWith('{') || token.startsWith(';')) continue
    const san = token.replace(/^\d+\.+/, '').replace(/\$\d+/g, '').replace(/[!?]+$/, '')
    if (san && !/^\.+$/.test(san) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(san)) yield san
  }
  if (variation) throw new Error('Unbalanced PGN variation.')
}

export async function exploreImportedGames(games: readonly GameRecord[], fen: string, options: ExplorerOptions = {}): Promise<ExplorerResult> {
  checkAbort(options.signal)
  const target = canonicalPosition(fen)
  const progress: ExplorerProgress = { scanned: 0, total: games.length, standardGames: 0, skippedGames: 0, duplicateGames: 0, matchingGames: 0 }
  const totals = new Map<string, ExplorerMove & { ratingTotal: number; ratingCount: number }>()
  const seen = new Set<string>()
  options.onProgress?.({ ...progress })
  await yieldToBrowser(options.signal)
  let sliceStarted = performance.now()
  for (const game of games) {
    checkAbort(options.signal)
    const id = game.url || game.id
    if (seen.has(id)) progress.duplicateGames += 1
    else {
      seen.add(id)
      if (game.rules !== 'chess') progress.skippedGames += 1
      else {
        const candidates = new Map<string, string>()
        let matches = false
        try {
          if (!game.pgn.trim()) throw new Error('Empty PGN.')
          const setup = game.pgn.match(/^\s*\[FEN\s+"([^"\r\n]+)"\]/m)?.[1]
          const board = setup ? new Chess(setup) : new Chess()
          matches = positionKey(board.fen()) === target
          for (const san of mainline(game.pgn)) {
            const move = board.move(san)
            if (positionKey(move.before) === target) candidates.set(`${move.from}${move.to}${move.promotion ?? ''}`, move.san)
            if (positionKey(move.after) === target) matches = true
            if (performance.now() - sliceStarted >= 12) {
              options.onProgress?.({ ...progress })
              await yieldToBrowser(options.signal)
              sliceStarted = performance.now()
            }
          }
          progress.standardGames += 1
          if (matches) progress.matchingGames += 1
          const ratings = [game.white.rating, game.black.rating].filter(rating => Number.isFinite(rating) && rating > 0)
          for (const [uci, san] of candidates) {
            const item = totals.get(uci) ?? { uci, san, games: 0, whiteWins: 0, draws: 0, blackWins: 0, unknownResults: 0, averageRating: null, ratingTotal: 0, ratingCount: 0 }
            item.games += 1
            item[resultOf(game)] += 1
            item.ratingTotal += ratings.reduce((sum, rating) => sum + rating, 0)
            item.ratingCount += ratings.length
            totals.set(uci, item)
          }
        } catch (error) {
          if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
          progress.skippedGames += 1
        }
      }
    }
    progress.scanned += 1
    if (performance.now() - sliceStarted >= 12) {
      options.onProgress?.({ ...progress })
      await yieldToBrowser(options.signal)
      sliceStarted = performance.now()
    }
  }
  checkAbort(options.signal)
  options.onProgress?.({ ...progress })
  checkAbort(options.signal)
  return {
    ...progress,
    fen: target,
    moves: [...totals.values()].map(({ ratingTotal, ratingCount, ...move }) => ({ ...move, averageRating: ratingCount ? Math.round(ratingTotal / ratingCount) : null }))
      .sort((a, b) => b.games - a.games || a.san.localeCompare(b.san)),
  }
}
