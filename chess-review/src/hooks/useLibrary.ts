import { useEffect, useRef, useState } from 'react'
import { importChessComGames, normalizeUsername, type ImportOptions, type ImportProgress } from '../lib/chesscom'
import type { GameRecord } from '../lib/game'
import { loadLibrary, saveLibrary } from '../lib/storage'

interface LibraryCallbacks {
  games: (games: GameRecord[]) => void
  username: (username: string) => void
  progress: (progress: ImportProgress | null) => void
  loading: (loading: boolean) => void
  error: (error: string) => void
  notice: (notice: string) => void
}

interface LibraryDependencies {
  load: (username: string) => Promise<GameRecord[] | undefined>
  save: (username: string, games: GameRecord[]) => Promise<void>
  importGames: (username: string, options: ImportOptions) => Promise<GameRecord[]>
}

const pendingSaves = new Map<string, Promise<void>>()

async function saveCompleteLibrary(username: string, games: GameRecord[], save: LibraryDependencies['save']) {
  const pending = (pendingSaves.get(username) ?? Promise.resolve()).catch(() => undefined).then(() => save(username, games))
  pendingSaves.set(username, pending)
  try { await pending } finally { if (pendingSaves.get(username) === pending) pendingSaves.delete(username) }
}

export function createLibraryImporter(callbacks: LibraryCallbacks, dependencies: LibraryDependencies = { load: loadLibrary, save: saveLibrary, importGames: importChessComGames }) {
  let active = true
  let current: { controller: AbortController; games: GameRecord[]; importing: boolean } | null = null
  const owns = (request: NonNullable<typeof current>) => active && current === request
  const live = (request: NonNullable<typeof current>) => owns(request) && !request.controller.signal.aborted

  async function importUser(raw: string) {
    if (!active) return
    let user: string
    try { user = normalizeUsername(raw) } catch (e) { callbacks.error((e as Error).message); return }
    current?.controller.abort()
    const request = { controller: new AbortController(), games: [] as GameRecord[], importing: true }
    current = request
    callbacks.loading(true)
    callbacks.error('')
    callbacks.notice('')
    callbacks.username(user)
    callbacks.progress(null)
    callbacks.games([])
    try {
      const cached = await dependencies.load(user).catch(() => undefined)
      if (!live(request)) return
      if (cached) {
        request.games = cached
        callbacks.games(cached)
        callbacks.notice('Saved games loaded. Checking all archives for updates…')
      }
      const result = await dependencies.importGames(user, {
        signal: request.controller.signal,
        onProgress: progress => { if (live(request)) callbacks.progress(progress) },
        onGames: batch => {
          if (!live(request)) return
          const byId = new Map(request.games.map(game => [game.id, game]))
          batch.forEach(game => byId.set(game.id, game))
          request.games = [...byId.values()].sort((a, b) => b.endTime - a.endTime)
          callbacks.games(request.games)
        },
      })
      if (!live(request)) return
      request.games = result
      request.importing = false
      callbacks.games(result)
      callbacks.loading(false)
      callbacks.notice(result.length ? `All ${result.length.toLocaleString()} public games imported.` : 'This player has no archived public games yet.')
      await saveCompleteLibrary(user, result, dependencies.save).catch(() => {
        if (live(request)) callbacks.notice('All games imported. Browser storage is unavailable; keep this tab open to retain them.')
      })
    } catch (e) {
      if (live(request)) callbacks.error((e as Error).message)
    } finally {
      request.importing = false
      if (owns(request)) callbacks.loading(false)
    }
  }

  return {
    importUser,
    cancel: () => {
      if (!active || !current?.importing || current.controller.signal.aborted) return
      current.controller.abort()
      callbacks.loading(false)
      callbacks.notice(`Import stopped. ${current.games.length.toLocaleString()} loaded games remain available.`)
    },
    activate: () => { active = true },
    dispose: () => { active = false; current?.controller.abort() },
  }
}

export function useLibrary() {
  const [games, setGames] = useState<GameRecord[]>([])
  const [username, setUsername] = useState('')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const importer = useRef<ReturnType<typeof createLibraryImporter> | null>(null)
  if (!importer.current) importer.current = createLibraryImporter({ games: setGames, username: setUsername, progress: setProgress, loading: setLoading, error: setError, notice: setNotice })
  const service = importer.current

  useEffect(() => { service.activate(); return () => service.dispose() }, [service])

  return { games, username, progress, loading, error, notice, importUser: service.importUser, cancel: service.cancel }
}
