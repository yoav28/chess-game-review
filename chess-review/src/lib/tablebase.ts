import { Chess } from 'chess.js'

export type TablebaseCategory = 'win' | 'loss' | 'draw' | 'cursed-win' | 'blessed-loss' | 'syzygy-win' | 'syzygy-loss' | 'maybe-win' | 'maybe-loss' | 'unknown'
export interface TablebaseMove {
  uci: string
  san: string
  category: TablebaseCategory
  afterDtz: number | null
  afterPreciseDtz: number | null
}
export interface TablebaseResult {
  fen: string
  turn: 'w' | 'b'
  category: TablebaseCategory
  dtz: number | null
  preciseDtz: number | null
  moves: TablebaseMove[]
  checkmate: boolean
  stalemate: boolean
}

const opposite: Record<TablebaseCategory, TablebaseCategory> = {
  win: 'loss', loss: 'win', draw: 'draw', 'cursed-win': 'blessed-loss', 'blessed-loss': 'cursed-win',
  'syzygy-win': 'syzygy-loss', 'syzygy-loss': 'syzygy-win', 'maybe-win': 'maybe-loss', 'maybe-loss': 'maybe-win', unknown: 'unknown',
}
export const tablebaseCategoryLabel: Record<TablebaseCategory, string> = {
  win: 'Win', loss: 'Loss', draw: 'Draw', 'cursed-win': 'Draw by fifty-move rule · cursed win',
  'blessed-loss': 'Draw by fifty-move rule · blessed loss', 'syzygy-win': 'Win or fifty-move draw',
  'syzygy-loss': 'Loss or fifty-move draw', 'maybe-win': 'Possible win · incomplete information',
  'maybe-loss': 'Possible loss · incomplete information', unknown: 'Unknown',
}

export function tablebaseEligibility(fen: string) {
  try {
    const board = new Chess(fen)
    const pieces = board.board().flat().filter(Boolean).length
    if (pieces > 7) return { eligible: false, reason: 'Available when seven or fewer pieces remain, including both kings.', fen: board.fen(), pieces }
    if (board.fen().split(' ')[2] !== '-') return { eligible: false, reason: 'Tablebases do not support positions with castling rights.', fen: board.fen(), pieces }
    return { eligible: true, reason: '', fen: board.fen(), pieces }
  } catch {
    return { eligible: false, reason: 'Select a valid standard chess position.', fen: null, pieces: 0 }
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The tablebase returned an invalid response.')
  return value as Record<string, unknown>
}

function category(value: unknown): TablebaseCategory {
  if (typeof value !== 'string' || !Object.hasOwn(opposite, value)) throw new Error('The tablebase returned an unrecognized result.')
  return value as TablebaseCategory
}

function metric(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isSafeInteger(value)) throw new Error('The tablebase returned an invalid distance.')
  return value as number
}

function parseResult(fen: string, value: unknown): TablebaseResult {
  const data = record(value)
  const board = new Chess(fen)
  const legal = new Map(board.moves({ verbose: true }).map(move => [`${move.from}${move.to}${move.promotion ?? ''}`, move.san]))
  if (!Array.isArray(data.moves)) throw new Error('The tablebase did not return its legal moves.')
  const seen = new Set<string>()
  const moves = data.moves.map(item => {
    const move = record(item)
    if (typeof move.uci !== 'string' || !legal.has(move.uci) || seen.has(move.uci)) throw new Error('The tablebase returned an invalid or repeated move.')
    seen.add(move.uci)
    return { uci: move.uci, san: legal.get(move.uci)!, category: opposite[category(move.category)], afterDtz: metric(move.dtz), afterPreciseDtz: metric(move.precise_dtz) }
  })
  if (seen.size !== legal.size) throw new Error('The tablebase returned an incomplete move list. Please try again.')
  return { fen, turn: board.turn(), category: category(data.category), dtz: metric(data.dtz), preciseDtz: metric(data.precise_dtz), moves, checkmate: board.isCheckmate(), stalemate: board.isStalemate() }
}

export function createTablebaseClient(fetcher: typeof fetch = (...args) => fetch(...args), timeoutMs = 12_000) {
  const cache = new Map<string, { result: TablebaseResult; expires: number }>()
  return async (fen: string, signal?: AbortSignal): Promise<TablebaseResult> => {
    const eligibility = tablebaseEligibility(fen)
    if (!eligibility.eligible || !eligibility.fen) throw new Error(eligibility.reason)
    const key = eligibility.fen
    if (signal?.aborted) throw new DOMException('Tablebase probe cancelled.', 'AbortError')
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) return structuredClone(cached.result)
    cache.delete(key)
    const controller = new AbortController()
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let abort: () => void = () => {}
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => { controller.abort(); reject(new DOMException('Tablebase probe cancelled.', 'AbortError')) }
      signal?.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error('The tablebase request timed out. Try again.')) }, timeoutMs)
    })
    try {
      const operation = async () => {
        const response = await fetcher(`https://tablebase.lichess.ovh/standard?${new URLSearchParams({ fen: key })}`, {
          signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' },
        })
        if (response.status === 429) throw new Error('Lichess is rate limiting tablebase requests. Wait a minute before trying again.')
        if (response.status === 404) throw new Error('The required tablebase is unavailable for this position.')
        if (!response.ok) throw new Error(`The tablebase request failed (${response.status}). Try again later.`)
        const result = parseResult(key, await response.json())
        if (signal?.aborted || controller.signal.aborted) throw new DOMException('Tablebase probe cancelled.', 'AbortError')
        cache.set(key, { result: structuredClone(result), expires: Date.now() + 600_000 })
        while (cache.size > 64) cache.delete(cache.keys().next().value!)
        return result
      }
      return await Promise.race([operation(), interrupted])
    } catch (error) {
      if (timedOut) throw new Error('The tablebase request timed out. Try again.')
      if (error instanceof SyntaxError) throw new Error('The tablebase returned unreadable data. Try again later.')
      if (error instanceof TypeError) throw new Error('Could not reach the Lichess tablebase. Check your connection or try again later.')
      throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
}

export const probeTablebase = createTablebaseClient()
