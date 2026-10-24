import { useEffect, useRef, useState } from 'react'
import { importChessComGames, normalizeUsername, type ImportOptions, type ImportProgress } from '../lib/chesscom'
import type { GameRecord } from '../lib/game'
import { gamesFromPgnFile } from '../lib/pgn-batch'
import { loadLibrary, loadPgnGames, saveLibrary, savePgnGames } from '../lib/storage'

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
  loadPgnGames?: (username: string) => Promise<GameRecord[] | undefined>
  savePgnGames?: (username: string, games: GameRecord[]) => Promise<void>
}

const pendingSaves = new Map<string, Promise<void>>()

async function saveCompleteLibrary(username: string, games: GameRecord[], save: LibraryDependencies['save']) {
  const pending = (pendingSaves.get(username) ?? Promise.resolve()).catch(() => undefined).then(() => save(username, games))
  pendingSaves.set(username, pending)
  try { await pending } finally { if (pendingSaves.get(username) === pending) pendingSaves.delete(username) }
}

function gameIdentity(game: GameRecord) {
  const initialPosition = game.pgn.match(/^\[FEN\s+"([^"]*)"\]/im)?.[1] ?? 'startpos'
  let movetext = game.pgn.replace(/^\s*\[[^\r\n]*\]\s*$/gm, ' ').replace(/\{[\s\S]*?\}|;[^\r\n]*/g, ' ')
  while (/\([^()]*\)/.test(movetext)) movetext = movetext.replace(/\([^()]*\)/g, ' ')
  const moves = movetext.trim().split(/\s+/).map(token => token.replace(/^\d+\.{1,3}/, '').replace(/\$\d+/g, '').replace(/[!?+#]+$/, '').toLowerCase()).filter(Boolean).join(' ')
  return [game.rules, initialPosition, game.endTime, game.timeControl, game.white.username.toLowerCase(), game.black.username.toLowerCase(), moves].join('|')
}

export function createLibraryImporter(callbacks: LibraryCallbacks, dependencies: LibraryDependencies = { load: loadLibrary, save: saveLibrary, importGames: importChessComGames }) {
  let active = true
  let current: { controller: AbortController; games: GameRecord[]; importing: boolean; username: string } | null = null
  const owns = (request: NonNullable<typeof current>) => active && current === request
  const live = (request: NonNullable<typeof current>) => owns(request) && !request.controller.signal.aborted
  const mergeGames = (...groups: GameRecord[][]) => {
    const byId = new Map<string, GameRecord>()
    const byUrl = new Set<string>()
    const byIdentity = new Set<string>()
    for (const game of groups.flat()) {
      const identity = gameIdentity(game)
      if (byId.has(game.id) || game.url && byUrl.has(game.url) || byIdentity.has(identity)) continue
      byId.set(game.id, game)
      if (game.url) byUrl.add(game.url)
      byIdentity.add(identity)
    }
    return [...byId.values()].sort((a, b) => b.endTime - a.endTime)
  }

  async function importUser(raw: string) {
    if (!active) return
    let user: string
    try { user = normalizeUsername(raw) } catch (e) { callbacks.error((e as Error).message); return }
    current?.controller.abort()
    const request = { controller: new AbortController(), games: [] as GameRecord[], importing: true, username: user }
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
      const pgnGames = await (dependencies.loadPgnGames ?? loadPgnGames)(user).catch(() => undefined) ?? []
      if (!live(request)) return
      if (cached) {
        request.games = mergeGames(cached, pgnGames)
        callbacks.games(request.games)
        callbacks.notice('Saved games loaded. Checking all archives for updates…')
      } else if (pgnGames.length) {
        request.games = pgnGames
        callbacks.games(pgnGames)
      }
      const result = await dependencies.importGames(user, {
        signal: request.controller.signal,
        onProgress: progress => { if (live(request)) callbacks.progress(progress) },
        onGames: batch => {
          if (!live(request)) return
          request.games = mergeGames(request.games, batch)
          callbacks.games(request.games)
        },
      })
      if (!live(request)) return
      const latestPgnGames = await (dependencies.loadPgnGames ?? loadPgnGames)(user).catch(() => undefined) ?? pgnGames
      if (!live(request)) return
      request.games = mergeGames(result, latestPgnGames)
      request.importing = false
      callbacks.games(request.games)
      callbacks.loading(false)
      callbacks.notice(result.length ? `All ${result.length.toLocaleString()} public games imported${latestPgnGames.length ? ` · ${latestPgnGames.length.toLocaleString()} PGN games included` : ''}.` : latestPgnGames.length ? `${latestPgnGames.length.toLocaleString()} saved PGN games loaded. This player has no public archive.` : 'This player has no archived public games yet.')
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
    importPgn: async (raw: string, text: string) => {
      let user: string
      try { user = normalizeUsername(raw) } catch (e) { callbacks.error((e as Error).message); return }
      callbacks.error('')
      callbacks.notice('')
      try {
        const incoming = gamesFromPgnFile(text)
        const existing = await (dependencies.loadPgnGames ?? loadPgnGames)(user).catch(() => undefined) ?? []
        const saved = mergeGames(existing, incoming)
        await (dependencies.savePgnGames ?? savePgnGames)(user, saved)
        const base = current?.username === user ? current.games : await dependencies.load(user).catch(() => undefined) ?? []
        callbacks.username(user)
        callbacks.games(mergeGames(base, incoming))
        const added = saved.length - existing.length
        callbacks.notice(`${added.toLocaleString()} PGN ${added === 1 ? 'game' : 'games'} added to ${user}${incoming.length - added ? ` · ${ (incoming.length - added).toLocaleString()} already saved` : ''}.`)
      } catch (e) {
        callbacks.error((e as Error).message)
      }
    },
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

  return { games, username, progress, loading, error, notice, importUser: service.importUser, importPgn: service.importPgn, cancel: service.cancel }
}
