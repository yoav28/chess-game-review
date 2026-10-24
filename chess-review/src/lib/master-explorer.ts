import { createPosition, positionMoveUci, type ChessVariant } from './position'

export const masterExplorerSource = 'https://lichess.org/api#tag/Opening-Explorer'
export const masterExplorerEndpoint = 'https://explorer.lichess.org/masters'
export type MasterOutcomes = { whiteWins: number; draws: number; blackWins: number; games: number }
export type MasterMove = MasterOutcomes & { uci: string; san: string; averageRating: number }
export type MasterGame = {
  id: string
  uci: string
  san: string
  winner: 'white' | 'black' | null
  white: { name: string; rating: number }
  black: { name: string; rating: number }
  year: number
  pgnUrl: string
}
export type MasterExplorerResult = MasterOutcomes & { fen: string; moves: MasterMove[]; topGames: MasterGame[] }

export function masterExplorerEligibility(fen: string, variant: ChessVariant = 'chess') {
  try {
    if (variant !== 'chess') throw new Error('The masters database supports standard chess positions only.')
    return { eligible: true, reason: '', fen: createPosition(fen, 'chess').fen() }
  } catch {
    return { eligible: false, reason: variant === 'chess' ? 'Select a valid standard chess position.' : 'The masters database supports standard chess positions only.', fen: null }
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The masters database returned an invalid response.')
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('The masters database returned invalid statistics.')
  return value as number
}

function outcomes(value: Record<string, unknown>): MasterOutcomes {
  const whiteWins = count(value.white)
  const draws = count(value.draws)
  const blackWins = count(value.black)
  const games = count(whiteWins + draws + blackWins)
  return { whiteWins, draws, blackWins, games }
}

function player(value: unknown): { name: string; rating: number } {
  const data = record(value)
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 150) throw new Error('The masters database returned invalid game details.')
  return { name: data.name, rating: count(data.rating) }
}

function parseResult(fen: string, value: unknown): MasterExplorerResult {
  const data = record(value)
  const totals = outcomes(data)
  const legal = new Map(createPosition(fen, 'chess').moves({ verbose: true }).map(move => [positionMoveUci(move), move.san]))
  if (!Array.isArray(data.moves) || !Array.isArray(data.topGames)) throw new Error('The masters database returned an incomplete response.')
  const seen = new Set<string>()
  const moves = data.moves.map(item => {
    const move = record(item)
    if (typeof move.uci !== 'string' || !legal.has(move.uci) || seen.has(move.uci)) throw new Error('The masters database returned an illegal or repeated move.')
    seen.add(move.uci)
    const stats = outcomes(move)
    if (stats.games > totals.games) throw new Error('The masters database returned inconsistent statistics.')
    return { ...stats, uci: move.uci, san: legal.get(move.uci)!, averageRating: count(move.averageRating) }
  }).sort((a, b) => b.games - a.games || a.san.localeCompare(b.san))
  const gameIds = new Set<string>()
  const topGames = data.topGames.map(item => {
    const game = record(item)
    if (typeof game.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(game.id) || gameIds.has(game.id)
      || typeof game.uci !== 'string' || !legal.has(game.uci) || !Number.isInteger(game.year) || (game.year as number) < 1000 || (game.year as number) > 9999
      || game.winner !== null && game.winner !== 'white' && game.winner !== 'black') throw new Error('The masters database returned invalid game details.')
    gameIds.add(game.id)
    return {
      id: game.id, uci: game.uci, san: legal.get(game.uci)!, winner: game.winner as MasterGame['winner'],
      white: player(game.white), black: player(game.black), year: game.year as number,
      pgnUrl: `${masterExplorerEndpoint}/pgn/${encodeURIComponent(game.id)}`,
    }
  })
  return { ...totals, fen, moves, topGames }
}

export function createMasterExplorerClient(fetcher: typeof fetch = (...args) => fetch(...args), timeoutMs = 12_000) {
  const cache = new Map<string, { result: MasterExplorerResult; expires: number }>()
  return async (fen: string, options: { signal?: AbortSignal; variant?: ChessVariant } = {}): Promise<MasterExplorerResult> => {
    const eligibility = masterExplorerEligibility(fen, options.variant)
    if (!eligibility.eligible || !eligibility.fen) throw new Error(eligibility.reason)
    const key = eligibility.fen
    const { signal } = options
    if (signal?.aborted) throw new DOMException('Masters lookup cancelled.', 'AbortError')
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) return structuredClone(cached.result)
    cache.delete(key)
    const controller = new AbortController()
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let abort: () => void = () => {}
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => { controller.abort(); reject(new DOMException('Masters lookup cancelled.', 'AbortError')) }
      signal?.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error('The masters lookup timed out. Try again.')) }, timeoutMs)
    })
    try {
      const operation = async () => {
        const response = await fetcher(`${masterExplorerEndpoint}?${new URLSearchParams({ fen: key, moves: '12', topGames: '5' })}`, {
          signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' },
        })
        if (response.status === 429) throw new Error('Lichess is rate limiting masters lookups. Wait a minute before trying again.')
        if (response.status === 401 || response.status === 403) throw new Error('The Lichess masters service denied this anonymous lookup. Imported-game exploration remains available.')
        if (!response.ok) throw new Error(`The masters lookup failed (${response.status}). Try again later.`)
        const result = parseResult(key, await response.json())
        if (signal?.aborted || controller.signal.aborted) throw new DOMException('Masters lookup cancelled.', 'AbortError')
        cache.set(key, { result: structuredClone(result), expires: Date.now() + 600_000 })
        while (cache.size > 32) cache.delete(cache.keys().next().value!)
        return result
      }
      return await Promise.race([operation(), interrupted])
    } catch (error) {
      if (timedOut) throw new Error('The masters lookup timed out. Try again.')
      if (error instanceof SyntaxError) throw new Error('The masters database returned unreadable data. Try again later.')
      if (error instanceof TypeError) throw new Error('Could not reach the Lichess masters database. Check your connection or try again later.')
      throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
}

export const exploreMasterGames = createMasterExplorerClient()
