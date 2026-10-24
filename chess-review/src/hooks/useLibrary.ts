import { useEffect, useRef, useState } from 'react'
import { importChessComGames, normalizeUsername, type ImportOptions, type ImportProgress } from '../lib/chesscom'
import type { GameRecord } from '../lib/game'
import { gamesFromPgnFile } from '../lib/pgn-batch'
import { loadLibrary, loadLibraryImportStatus, loadPgnGames, saveLibrary, saveLibraryImportStatus, savePgnGames, type LibraryImportStatus } from '../lib/storage'

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
  loadImportStatus?: (username: string) => Promise<LibraryImportStatus | undefined>
  saveImportStatus?: (username: string, status: LibraryImportStatus) => Promise<void>
}

const pendingSaves = new Map<string, Promise<void>>()
const pendingStatusSaves = new Map<string, Promise<void>>()
const usernameStorageKey = 'open-file-chess-com-username'

function savedUsername(): string {
  try { return localStorage.getItem(usernameStorageKey) ?? '' } catch { return '' }
}

function rememberUsername(username: string) {
  try { localStorage.setItem(usernameStorageKey, username) } catch {}
}

async function saveCompleteLibrary(username: string, games: GameRecord[], save: LibraryDependencies['save']) {
  const pending = (pendingSaves.get(username) ?? Promise.resolve()).catch(() => undefined).then(() => save(username, games))
  pendingSaves.set(username, pending)
  try { await pending } finally { if (pendingSaves.get(username) === pending) pendingSaves.delete(username) }
}

async function saveImportStatus(username: string, status: LibraryImportStatus, save: NonNullable<LibraryDependencies['saveImportStatus']>) {
  const pending = (pendingStatusSaves.get(username) ?? Promise.resolve()).catch(() => undefined).then(() => save(username, status))
  pendingStatusSaves.set(username, pending)
  try { await pending } finally { if (pendingStatusSaves.get(username) === pending) pendingStatusSaves.delete(username) }
}

function gameIdentity(game: GameRecord) {
  const initialPosition = game.pgn.match(/^\[FEN\s+"([^"]*)"\]/im)?.[1] ?? 'startpos'
  let movetext = game.pgn.replace(/^\s*\[[^\r\n]*\]\s*$/gm, ' ').replace(/\{[\s\S]*?\}|;[^\r\n]*/g, ' ')
  while (/\([^()]*\)/.test(movetext)) movetext = movetext.replace(/\([^()]*\)/g, ' ')
  const moves = movetext.trim().split(/\s+/).map(token => token.replace(/^\d+\.{1,3}/, '').replace(/\$\d+/g, '').replace(/[!?+#]+$/, '').toLowerCase()).filter(Boolean).join(' ')
  return [game.rules, initialPosition, game.white.username.trim().toLowerCase(), game.black.username.trim().toLowerCase(), moves].join('|')
}

export function createLibraryImporter(callbacks: LibraryCallbacks, dependencies: LibraryDependencies = { load: loadLibrary, save: saveLibrary, importGames: importChessComGames }) {
  let active = true
  let restoreSequence = 0
  let current: { controller: AbortController; games: GameRecord[]; importing: boolean; username: string; statusProgress: { archivesCompleted: number; archivesTotal: number; gamesLoaded: number }; statusFingerprint: string } | null = null
  const owns = (request: NonNullable<typeof current>) => active && current === request
  const live = (request: NonNullable<typeof current>) => owns(request) && !request.controller.signal.aborted
  const saveStatus = dependencies.saveImportStatus ?? saveLibraryImportStatus
  const loadStatus = dependencies.loadImportStatus ?? loadLibraryImportStatus
  const mergeGames = (...groups: GameRecord[][]) => {
    const byId = new Map<string, GameRecord>()
    const byUrl = new Set<string>()
    const byIdentity = new Map<string, number[]>()
    for (const game of groups.flat()) {
      const identity = gameIdentity(game)
      const dates = byIdentity.get(identity) ?? []
      if (byId.has(game.id) || game.url && byUrl.has(game.url) || dates.some(date => Math.abs(date - game.endTime) <= 36 * 60 * 60 || date === 0 && game.endTime === 0)) continue
      byId.set(game.id, game)
      if (game.url) byUrl.add(game.url)
      byIdentity.set(identity, [...dates, game.endTime])
    }
    return [...byId.values()].sort((a, b) => b.endTime - a.endTime)
  }
  const persistPartial = (request: NonNullable<typeof current>) => {
    void saveCompleteLibrary(request.username, request.games, dependencies.save).catch(() => {
      if (owns(request)) callbacks.notice('Loaded games remain available in this tab, but browser storage is unavailable.')
    })
    void saveImportStatus(request.username, { ...request.statusProgress, complete: false, updatedAt: new Date().toISOString() }, saveStatus).catch(() => undefined)
  }

  async function loadSavedUser(raw: string) {
    let user: string
    try { user = normalizeUsername(raw) } catch (e) { callbacks.error((e as Error).message); return }
    const sequence = ++restoreSequence
    callbacks.username(user)
    callbacks.error('')
    callbacks.notice('')
    callbacks.progress(null)
    const [cached, imported, status] = await Promise.all([
      dependencies.load(user).catch(() => undefined),
      (dependencies.loadPgnGames ?? loadPgnGames)(user).catch(() => undefined),
      loadStatus(user).catch(() => undefined),
    ])
    if (!active || sequence !== restoreSequence) return
    const restored = mergeGames(cached ?? [], imported ?? [])
    callbacks.games(restored)
    const complete = status?.complete ? status.archivesTotal
      ? ` All ${status.archivesTotal.toLocaleString()} public archive months are imported.`
      : ' No public archive months are available for this player.' : ''
    const incomplete = status && !status.complete ? status.archivesTotal
      ? ` The public archive import is incomplete (${status.archivesCompleted.toLocaleString()} of ${status.archivesTotal.toLocaleString()} months); choose Import all games to finish.`
      : ' The public archive import did not finish; choose Import all games to finish.' : ''
    callbacks.notice(restored.length ? `${restored.length.toLocaleString()} saved games restored.${complete}${incomplete}` : status?.complete ? 'No archived public games are available for this player.' : 'No saved games found. Import all public archives to start a library.')
  }

  async function importUser(raw: string) {
    if (!active) return
    let user: string
    try { user = normalizeUsername(raw) } catch (e) { callbacks.error((e as Error).message); return }
    restoreSequence += 1
    rememberUsername(user)
    if (current?.importing) persistPartial(current)
    current?.controller.abort()
    const request = {
      controller: new AbortController(), games: [] as GameRecord[], importing: true, username: user,
      statusProgress: { archivesCompleted: 0, archivesTotal: 0, gamesLoaded: 0 }, statusFingerprint: '',
    }
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
        onProgress: progress => {
          if (!live(request)) return
          callbacks.progress(progress)
          request.statusProgress = { archivesCompleted: progress.archivesCompleted, archivesTotal: progress.archivesTotal, gamesLoaded: progress.gamesLoaded }
          const fingerprint = `${progress.archivesCompleted}/${progress.archivesTotal}/${progress.gamesLoaded}`
          if (fingerprint !== request.statusFingerprint) {
            request.statusFingerprint = fingerprint
            const status: LibraryImportStatus = { ...request.statusProgress, complete: false, updatedAt: new Date().toISOString() }
            void saveImportStatus(user, status, saveStatus).catch(() => undefined)
          }
        },
        onGames: batch => {
          if (!live(request)) return
          request.games = mergeGames(request.games, batch)
          callbacks.games(request.games)
          persistPartial(request)
        },
      })
      if (!live(request)) return
      const latestPgnGames = await (dependencies.loadPgnGames ?? loadPgnGames)(user).catch(() => undefined) ?? pgnGames
      if (!live(request)) return
      request.games = mergeGames(result, latestPgnGames)
      request.importing = false
      callbacks.games(request.games)
      callbacks.loading(false)
      let storageError = false
      await saveCompleteLibrary(user, result, dependencies.save).catch(() => { storageError = true })
      if (!storageError) {
        await saveImportStatus(user, { ...request.statusProgress, gamesLoaded: result.length, complete: true, updatedAt: new Date().toISOString() }, saveStatus).catch(() => { storageError = true })
      }
      if (storageError) {
        callbacks.notice('All games imported. Browser storage is unavailable; keep this tab open to retain them.')
      } else {
        const notice = result.length ? `All ${result.length.toLocaleString()} public games imported${latestPgnGames.length ? ` · ${latestPgnGames.length.toLocaleString()} PGN games included` : ''}.` : latestPgnGames.length ? `${latestPgnGames.length.toLocaleString()} saved PGN games loaded. This player has no public archive.` : 'This player has no archived public games yet.'
        callbacks.notice(notice)
      }
    } catch (e) {
      if (live(request)) {
        callbacks.error((e as Error).message)
        persistPartial(request)
      }
    } finally {
      request.importing = false
      if (owns(request)) callbacks.loading(false)
    }
  }

  return {
    importUser,
    loadSavedUser,
    importPgn: async (raw: string, text: string) => {
      let user: string
      try { user = normalizeUsername(raw) } catch (e) { callbacks.error((e as Error).message); return }
      restoreSequence += 1
      rememberUsername(user)
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
      persistPartial(current)
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
  const [username, setUsername] = useState(savedUsername)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const importer = useRef<ReturnType<typeof createLibraryImporter> | null>(null)
  if (!importer.current) importer.current = createLibraryImporter({ games: setGames, username: setUsername, progress: setProgress, loading: setLoading, error: setError, notice: setNotice })
  const service = importer.current
  const initialUsername = useRef(username)

  useEffect(() => {
    service.activate()
    if (initialUsername.current) void service.loadSavedUser(initialUsername.current)
    return () => service.dispose()
  }, [service])

  return { games, username, progress, loading, error, notice, importUser: service.importUser, importPgn: service.importPgn, cancel: service.cancel }
}
