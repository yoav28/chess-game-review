import type { GamePlayer, GameRecord } from './game'

export interface ImportProgress {
  phase: 'archives' | 'games' | 'complete'
  username: string
  archivesCompleted: number
  archivesTotal: number
  gamesLoaded: number
  currentArchive?: string
}

export interface ImportOptions {
  signal?: AbortSignal
  onProgress?: (progress: ImportProgress) => void
  onGames?: (games: GameRecord[]) => void
  fetcher?: typeof fetch
  retryDelayMs?: number
}

export class ChessComError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ChessComError'
    this.status = status
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeUsername(username: string): string {
  const value = username.trim().toLowerCase()
  if (!/^[a-z0-9_-]{1,50}$/.test(value)) throw new ChessComError('Enter a Chess.com username using letters, numbers, underscores, or hyphens.')
  return value
}

function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Game import cancelled.', 'AbortError')
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  abort(signal)
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Game import cancelled.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function retryDelay(response: Response, attempt: number, base: number): number {
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(milliseconds) && milliseconds >= 0) return Math.min(milliseconds, 120_000)
  }
  return Math.min(base * 2 ** attempt, 30_000)
}

async function getJson(url: string, options: ImportOptions): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch
  for (let attempt = 0; attempt < 4; attempt += 1) {
    abort(options.signal)
    let response: Response
    try {
      response = await fetcher(url, { signal: options.signal, headers: { Accept: 'application/json' } })
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
      if (attempt < 3) {
        await wait((options.retryDelayMs ?? 1000) * 2 ** attempt, options.signal)
        continue
      }
      throw new ChessComError('Could not reach Chess.com. Check your connection and try importing again.')
    }
    if (response.ok) {
      try {
        return await response.json()
      } catch {
        throw new ChessComError('Chess.com returned an unreadable response. Please try again.')
      }
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await wait(retryDelay(response, attempt, options.retryDelayMs ?? 1000), options.signal)
      continue
    }
    if (response.status === 404) throw new ChessComError('This Chess.com username or game archive was not found. Check the spelling and try again.', 404)
    if (response.status === 429) throw new ChessComError('Chess.com is limiting requests. Please wait a moment before trying again.', 429)
    throw new ChessComError(`Chess.com could not load this archive (${response.status}). Try again shortly.`, response.status)
  }
  throw new ChessComError('Chess.com is unavailable. Please try again.')
}

function player(value: unknown): GamePlayer {
  if (!record(value) || typeof value.username !== 'string') throw new ChessComError('Chess.com returned a game without player information.')
  return {
    username: value.username,
    rating: typeof value.rating === 'number' ? value.rating : 0,
    result: typeof value.result === 'string' ? value.result : 'unknown',
  }
}

function game(value: unknown): GameRecord {
  if (!record(value) || typeof value.url !== 'string' || typeof value.pgn !== 'string') throw new ChessComError('Chess.com returned an incomplete game. Please try importing again.')
  return {
    id: value.url,
    url: value.url,
    pgn: value.pgn,
    white: player(value.white),
    black: player(value.black),
    timeClass: typeof value.time_class === 'string' ? value.time_class : 'unknown',
    timeControl: typeof value.time_control === 'string' ? value.time_control : '-',
    endTime: typeof value.end_time === 'number' ? value.end_time : 0,
    rules: typeof value.rules === 'string' ? value.rules : 'chess',
    eco: typeof value.eco === 'string' ? value.eco : undefined,
  }
}

function archiveUrls(value: unknown, username: string): string[] {
  if (!record(value) || !Array.isArray(value.archives)) throw new ChessComError('Chess.com did not return a valid archive list.')
  const allowedPath = `/pub/player/${username}/games/`
  const urls = value.archives.map((entry: unknown) => {
    if (typeof entry !== 'string') throw new ChessComError('Chess.com returned an invalid archive address.')
    let url: URL
    try { url = new URL(entry) } catch { throw new ChessComError('Chess.com returned an invalid archive address.') }
    if (url.origin !== 'https://api.chess.com' || !url.pathname.startsWith(allowedPath) || !/^\d{4}\/(0[1-9]|1[0-2])$/.test(url.pathname.slice(allowedPath.length)) || url.search || url.hash) {
      throw new ChessComError('Chess.com returned an unexpected archive address.')
    }
    return url.href
  })
  return [...new Set(urls)].sort().reverse()
}

export async function importChessComGames(rawUsername: string, options: ImportOptions = {}): Promise<GameRecord[]> {
  const username = normalizeUsername(rawUsername)
  const progress: ImportProgress = { phase: 'archives', username, archivesCompleted: 0, archivesTotal: 0, gamesLoaded: 0 }
  options.onProgress?.({ ...progress })
  const archiveData = await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`, options)
  const archives = archiveUrls(archiveData, username)
  progress.phase = 'games'
  progress.archivesTotal = archives.length
  options.onProgress?.({ ...progress })
  const games = new Map<string, GameRecord>()
  for (const url of archives) {
    abort(options.signal)
    progress.currentArchive = url.slice(-7)
    options.onProgress?.({ ...progress })
    const payload = await getJson(url, options)
    abort(options.signal)
    if (!record(payload) || !Array.isArray(payload.games)) throw new ChessComError(`Chess.com returned an invalid game archive for ${progress.currentArchive}.`)
    const added: GameRecord[] = []
    for (const entry of payload.games) {
      const imported = game(entry)
      if (!games.has(imported.id)) added.push(imported)
      games.set(imported.id, imported)
    }
    progress.archivesCompleted += 1
    progress.gamesLoaded = games.size
    if (added.length) options.onGames?.(added)
    options.onProgress?.({ ...progress })
  }
  abort(options.signal)
  progress.phase = 'complete'
  progress.currentArchive = undefined
  options.onProgress?.({ ...progress })
  return [...games.values()].sort((left, right) => right.endTime - left.endTime || left.id.localeCompare(right.id))
}
