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
export const loadReview = (id: string) => read<GameReview>('reviews', id)
export const saveReview = (id: string, review: GameReview) => write('reviews', id, review)

export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
