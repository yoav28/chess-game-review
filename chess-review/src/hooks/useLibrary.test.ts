import test from 'node:test'
import assert from 'node:assert/strict'
import { createLibraryImporter } from './useLibrary'
import type { ImportOptions, ImportProgress } from '../lib/chesscom'
import type { GameRecord } from '../lib/game'
import { demoGame } from '../lib/demo'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function sink() {
  const state = { games: [] as GameRecord[], username: '', progress: null as ImportProgress | null, loading: false, error: '', notice: '' }
  const events: string[] = []
  const callbacks = {
    games: (value: GameRecord[]) => { state.games = value; events.push('games') },
    username: (value: string) => { state.username = value; events.push('username') },
    progress: (value: ImportProgress | null) => { state.progress = value; events.push('progress') },
    loading: (value: boolean) => { state.loading = value; events.push('loading') },
    error: (value: string) => { state.error = value; events.push('error') },
    notice: (value: string) => { state.notice = value; events.push('notice') },
  }
  return { state, events, callbacks }
}

const game = (id: string, endTime = 1, pgn = demoGame.pgn): GameRecord => ({ ...demoGame, id, endTime, pgn })
const progress: ImportProgress = { phase: 'games', username: 'ada', archivesCompleted: 1, archivesTotal: 2, gamesLoaded: 1 }

async function waitFor(predicate: () => boolean, description: string) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  assert.fail(`Timed out waiting for ${description}.`)
}

test('a superseded import cannot publish games, progress, errors, notices or loading changes', async () => {
  const view = sink()
  const oldResult = deferred<GameRecord[]>()
  const newResult = deferred<GameRecord[]>()
  const calls = new Map<string, ImportOptions>()
  const importer = createLibraryImporter(view.callbacks, {
    load: async () => undefined,
    save: async () => undefined,
    importGames: (username, options) => { calls.set(username, options); return username === 'ada' ? oldResult.promise : newResult.promise },
  })
  const oldImport = importer.importUser('ada')
  await waitFor(() => calls.has('ada'), 'the first archive request')
  const newImport = importer.importUser('grace')
  await waitFor(() => calls.has('grace'), 'the replacement archive request')
  assert.equal(calls.get('ada')?.signal?.aborted, true)
  const eventCount = view.events.length
  calls.get('ada')?.onGames?.([game('stale')])
  calls.get('ada')?.onProgress?.(progress)
  oldResult.reject(new DOMException('Cancelled', 'AbortError'))
  await oldImport
  assert.equal(view.events.length, eventCount)
  assert.equal(view.state.loading, true)
  newResult.resolve([game('current')])
  await newImport
  assert.equal(view.state.username, 'grace')
  assert.deepEqual(view.state.games.map(value => value.id), ['current'])
  assert.equal(view.state.notice, 'All 1 public games imported.')
  assert.equal(view.state.loading, false)
})

test('Stop during cache loading is immediate and prevents the network import', async () => {
  const view = sink()
  const cache = deferred<GameRecord[] | undefined>()
  let importCalls = 0
  const importer = createLibraryImporter(view.callbacks, {
    load: () => cache.promise,
    save: async () => undefined,
    importGames: async () => { importCalls += 1; return [] },
  })
  const pending = importer.importUser('ada')
  importer.cancel()
  assert.equal(view.state.loading, false)
  assert.equal(view.state.notice, 'Import stopped. 0 loaded games remain available.')
  cache.resolve([game('cached')])
  await pending
  assert.equal(importCalls, 0)
  assert.deepEqual(view.state.games, [])
})

test('partial batches persist, and callbacks arriving after Stop cannot overwrite them', async () => {
  const view = sink()
  const result = deferred<GameRecord[]>()
  let options: ImportOptions | undefined
  const writes: string[][] = []
  const importer = createLibraryImporter(view.callbacks, {
    load: async () => [game('old', 1)],
    save: async (_, games) => { writes.push(games.map(value => value.id)) },
    importGames: (_, value) => { options = value; return result.promise },
  })
  const pending = importer.importUser('ada')
  await waitFor(() => options !== undefined, 'the partial-import callback')
  options?.onGames?.([game('new', 2, demoGame.pgn.replace('1. e4', '1. d4'))])
  assert.deepEqual(view.state.games.map(value => value.id), ['new', 'old'])
  importer.cancel()
  options?.onGames?.([game('late', 3)])
  result.reject(new DOMException('Cancelled', 'AbortError'))
  await pending
  await waitFor(() => writes.length === 2, 'partial and stopped library writes')
  assert.deepEqual(view.state.games.map(value => value.id), ['new', 'old'])
  assert.equal(view.state.notice, 'Import stopped. 2 loaded games remain available.')
  assert.deepEqual(writes, [['new', 'old'], ['new', 'old']])
})

test('unmount suppresses continuations from cache loading, network callbacks, and storage failures', async () => {
  const cacheView = sink()
  const cache = deferred<GameRecord[] | undefined>()
  const cacheImporter = createLibraryImporter(cacheView.callbacks, { load: () => cache.promise, save: async () => undefined, importGames: async () => [] })
  const cachePending = cacheImporter.importUser('ada')
  cacheImporter.dispose()
  const cacheEvents = cacheView.events.length
  cache.resolve([game('cached')])
  await cachePending
  assert.equal(cacheView.events.length, cacheEvents)

  const view = sink()
  const stored = deferred<void>()
  let options: ImportOptions | undefined
  const importer = createLibraryImporter(view.callbacks, {
    load: async () => undefined,
    save: () => stored.promise,
    importGames: async (_, value) => { options = value; return [game('one')] },
  })
  const pending = importer.importUser('ada')
  await waitFor(() => options !== undefined, 'the in-flight import callback')
  importer.dispose()
  const eventCount = view.events.length
  options?.onGames?.([game('late')])
  options?.onProgress?.(progress)
  stored.reject(new Error('Storage unavailable'))
  await pending
  assert.equal(view.events.length, eventCount)
})

test('complete cache writes stay ordered and an old storage failure cannot replace a new notice', async () => {
  const view = sink()
  const firstSave = deferred<void>()
  const writes: string[][] = []
  let imports = 0
  const importer = createLibraryImporter(view.callbacks, {
    load: async () => undefined,
    save: async (_, games) => {
      writes.push(games.map(value => value.id))
      if (writes.length === 1) await firstSave.promise
    },
    importGames: async () => ++imports === 1 ? [game('old')] : [game('new', 2, demoGame.pgn.replace('1. e4', '1. d4')), game('newer', 3, demoGame.pgn.replace('1. e4', '1. c4'))],
  })
  const oldImport = importer.importUser('ada')
  await waitFor(() => writes.length === 1, 'the first saved archive')
  const newImport = importer.importUser('ada')
  await waitFor(() => imports === 2, 'the replacement network import')
  assert.deepEqual(writes, [['old']])
  firstSave.reject(new Error('Old storage failed'))
  await Promise.all([oldImport, newImport])
  assert.deepEqual(writes, [['old'], ['new', 'newer']])
  assert.equal(view.state.notice, 'All 2 public games imported.')
  assert.deepEqual(view.state.games.map(value => value.id), ['newer', 'new'])
})

test('a completed import replaces cached stale games with authoritative complete history', async () => {
  const view = sink()
  let saved: GameRecord[] = []
  const importer = createLibraryImporter(view.callbacks, {
    load: async () => [game('removed')],
    save: async (_, games) => { saved = games },
    importGames: async (_, options) => { options.onGames?.([game('current')]); return [game('current')] },
  })
  await importer.importUser('ada')
  assert.deepEqual(view.state.games.map(value => value.id), ['current'])
  assert.deepEqual(saved.map(value => value.id), ['current'])
})

test('identical moves with distinct Chess.com archive URLs remain separate library games', async () => {
  const view = sink()
  const first = { ...game('one', 100), url: 'https://www.chess.com/game/live/1001' }
  const second = { ...game('two', 101), url: 'https://www.chess.com/game/live/1002' }
  let saved: GameRecord[] = []
  const importer = createLibraryImporter(view.callbacks, {
    load: async () => undefined,
    save: async (_, games) => { saved = games },
    importGames: async () => [first, second],
  })

  await importer.importUser('ada')
  assert.deepEqual(view.state.games.map(value => value.id), ['two', 'one'])
  assert.deepEqual(saved.map(value => value.id), ['one', 'two'])
})
