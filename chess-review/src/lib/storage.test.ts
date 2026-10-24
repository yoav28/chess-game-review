import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSavedReviews } from './storage'
import { buildReview, parsePgn } from './review'

function fixture() {
  const game = parsePgn('[White "Ada"]\n[Black "Grace"]\n\n1. e4 e5 *')
  return buildReview(game, [game.initialFen, ...game.moves.map(move => move.afterFen)].map((fen, index) => ({
    fen, evaluation: { cp: 0, mate: null }, bestMove: game.moves[index]?.uci ?? null,
    bestMoveSan: game.moves[index]?.san ?? null, pv: [], pvSan: [], depth: 16, lines: [],
  })))
}

async function withDatabase(records: { key: unknown; value: unknown }[], outcome: 'complete' | 'abort' | 'error', run: (state: { closed: boolean; mode?: string; store?: string }) => Promise<void>) {
  const previous = globalThis.indexedDB
  const state: { closed: boolean; mode?: string; store?: string } = { closed: false }
  const transaction = { error: new Error('Storage interrupted'), oncomplete: () => {}, onabort: () => {}, onerror: () => {} }
  const request = { result: null as unknown, error: new Error('Cursor failed'), onsuccess: () => {}, onerror: () => {} }
  let index = 0
  const next = () => {
    if (outcome === 'error') { request.onerror(); return }
    if (outcome === 'abort' && index > 0) { transaction.onabort(); return }
    const record = records[index]
    request.result = record ? { ...record, continue: () => { index++; queueMicrotask(next) } } : null
    request.onsuccess()
    if (!record) queueMicrotask(() => transaction.oncomplete())
  }
  const db = {
    transaction: (store: string, mode?: string) => {
      state.mode = mode
      state.store = store
      return Object.assign(transaction, { objectStore: () => ({ openCursor: () => { queueMicrotask(next); return request } }) })
    },
    close: () => { state.closed = true },
  }
  const openRequest = { result: db, onsuccess: () => {}, onerror: () => {} }
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => { queueMicrotask(() => openRequest.onsuccess()); return openRequest } } })
  try { await run(state) } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: previous })
    else delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
  }
}

test('saved reviews read actual keys with a readonly cursor, skip malformed records, and close storage', async () => {
  const review = fixture()
  await withDatabase([
    { key: 'chesscom-1', value: review }, { key: '', value: review }, { key: 22, value: review },
    { key: 'broken', value: { version: 1 } }, { key: 'bad-score', value: { ...review, whiteAccuracy: 'high' } },
    { key: 'bad-move', value: { ...review, moves: [{ ...review.moves[0], accuracy: NaN }] } },
  ], 'complete', async state => {
    assert.deepEqual(await loadSavedReviews(), [{ id: 'chesscom-1', review }])
    assert.deepEqual(state, { closed: true, mode: 'readonly', store: 'reviews' })
  })
})

test('aborted cursor transaction rejects instead of returning a partial history and always closes', async () => {
  await withDatabase([{ key: 'saved', value: fixture() }], 'abort', async state => {
    await assert.rejects(loadSavedReviews(), /Storage interrupted/)
    assert.equal(state.closed, true)
  })
})

test('cursor failure rejects and closes the connection', async () => {
  await withDatabase([], 'error', async state => {
    await assert.rejects(loadSavedReviews(), /Cursor failed/)
    assert.equal(state.closed, true)
  })
})
