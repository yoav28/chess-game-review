import type { GameRecord } from './game'
import type { GameReview } from './review'

const database = 'open-file-v1'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('libraries')
      request.result.createObjectStore('reviews')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await open()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

async function write(store: string, key: string, value: unknown): Promise<void> {
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      transaction.objectStore(store).put(value, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}

export const loadLibrary = (username: string) => read<GameRecord[]>('libraries', username)
export const saveLibrary = (username: string, games: GameRecord[]) => write('libraries', username, games)
export const loadPgnGames = (username: string) => read<GameRecord[]>('libraries', `${username}:pgn-imports`)
export const savePgnGames = (username: string, games: GameRecord[]) => write('libraries', `${username}:pgn-imports`, games)
export type LibraryImportStatus = { complete: boolean; archivesCompleted: number; archivesTotal: number; gamesLoaded: number; updatedAt: string }
const importStatusKey = (username: string) => `open-file-chess-com-import-status:${username}`
export async function loadLibraryImportStatus(username: string): Promise<LibraryImportStatus | undefined> {
  try {
    const value = JSON.parse(localStorage.getItem(importStatusKey(username)) ?? 'null') as Partial<LibraryImportStatus> | null
    return value && typeof value.complete === 'boolean' && Number.isInteger(value.archivesCompleted) && Number.isInteger(value.archivesTotal)
      && Number.isInteger(value.gamesLoaded) && typeof value.updatedAt === 'string'
      ? value as LibraryImportStatus : undefined
  } catch { return undefined }
}
export async function saveLibraryImportStatus(username: string, status: LibraryImportStatus): Promise<void> {
  localStorage.setItem(importStatusKey(username), JSON.stringify(status))
}
export const loadReview = (id: string) => read<GameReview>('reviews', id)
export const saveReview = (id: string, review: GameReview) => write('reviews', id, review)

export type SavedReview = { id: string; review: GameReview }

function validReview(value: unknown): value is GameReview {
  if (!value || typeof value !== 'object') return false
  const review = value as Partial<GameReview>
  return review.version === 1 && typeof review.pgn === 'string' && typeof review.initialFen === 'string'
    && typeof review.white === 'string' && typeof review.black === 'string' && typeof review.result === 'string'
    && typeof review.analyzedAt === 'string' && typeof review.engine === 'string' && typeof review.accuracyModel === 'string'
    && Boolean(review.headers && typeof review.headers === 'object')
    && [review.whiteAccuracy, review.blackAccuracy].every(accuracy => accuracy === null || typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100)
    && Boolean(review.counts?.w && review.counts?.b && review.initialAnalysis?.evaluation)
    && Array.isArray(review.phases) && Array.isArray(review.keyMoments) && Array.isArray(review.moves)
    && review.moves.every(move => move && (move.color === 'w' || move.color === 'b')
      && typeof move.san === 'string' && typeof move.beforeFen === 'string' && typeof move.afterFen === 'string'
      && Number.isFinite(move.accuracy) && move.accuracy >= 0 && move.accuracy <= 100)
}

export async function loadSavedReviews(): Promise<SavedReview[]> {
  const db = await open()
  try {
    return await new Promise((resolve, reject) => {
      const entries: SavedReview[] = []
      const transaction = db.transaction('reviews', 'readonly')
      const request = transaction.objectStore('reviews').openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        if (typeof cursor.key === 'string' && cursor.key && validReview(cursor.value)) entries.push({ id: cursor.key, review: cursor.value })
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => resolve(entries)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Loading saved reviews was interrupted.'))
    })
  } finally { db.close() }
}

export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
