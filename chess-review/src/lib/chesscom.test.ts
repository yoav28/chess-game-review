import test from 'node:test'
import assert from 'node:assert/strict'
import { importChessComGames, normalizeUsername, type ImportProgress } from './chesscom'

const base = 'https://api.chess.com/pub/player/ada/games/'
const rawGame = (id: number, endTime = id) => ({
  url: `https://www.chess.com/game/live/${id}`,
  pgn: '1. e4 e5 *',
  end_time: endTime,
  time_class: 'rapid',
  time_control: '600',
  rules: 'chess',
  white: { username: 'Ada', rating: 1500, result: 'win' },
  black: { username: 'Grace', rating: 1501, result: 'resigned' },
})
const json = (value: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(value), { status, headers })

test('imports every monthly archive sequentially, newest first, without duplicate games', async () => {
  const requests: string[] = []
  const progress: ImportProgress[] = []
  const batches: number[] = []
  let active = 0
  let maxActive = 0
  const fetcher: typeof fetch = async (input) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    const url = String(input)
    requests.push(url)
    await Promise.resolve()
    active -= 1
    if (url.endsWith('archives')) return json({ archives: [`${base}2024/01`, `${base}2025/01`, `${base}2025/02`, `${base}2025/02`] })
    if (url.endsWith('2025/02')) return json({ games: [rawGame(3), rawGame(2)] })
    if (url.endsWith('2025/01')) return json({ games: [rawGame(2), rawGame(1)] })
    return json({ games: [rawGame(0)] })
  }
  const games = await importChessComGames(' Ada ', { fetcher, onProgress: (value) => progress.push(value), onGames: (batch) => batches.push(batch.length) })
  assert.deepEqual(requests, [`${base}archives`, `${base}2025/02`, `${base}2025/01`, `${base}2024/01`])
  assert.equal(maxActive, 1)
  assert.deepEqual(games.map((game) => game.endTime), [3, 2, 1, 0])
  assert.deepEqual(batches, [2, 1, 1])
  assert.deepEqual(progress.at(-1), { phase: 'complete', username: 'ada', archivesCompleted: 3, archivesTotal: 3, gamesLoaded: 4, currentArchive: undefined })
  assert.equal(games[0].white.rating, 1500)
  assert.equal(games[0].timeControl, '600')
})

test('retries a rate-limited archive and respects Retry-After', async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => {
    calls += 1
    if (calls === 1) return json({ archives: [`${base}2025/01`] })
    if (calls === 2) return json({}, 429, { 'Retry-After': '0' })
    return json({ games: [rawGame(1)] })
  }
  const games = await importChessComGames('ada', { fetcher, retryDelayMs: 0 })
  assert.equal(calls, 3)
  assert.equal(games.length, 1)
})

test('an aborted import makes no further monthly requests and never reports completion', async () => {
  const controller = new AbortController()
  let calls = 0
  const phases: string[] = []
  const fetcher: typeof fetch = async () => {
    calls += 1
    if (calls === 1) return json({ archives: [`${base}2025/01`, `${base}2025/02`] })
    return json({ games: [rawGame(1)] })
  }
  await assert.rejects(importChessComGames('ada', {
    fetcher,
    signal: controller.signal,
    onGames: () => controller.abort(),
    onProgress: (progress) => phases.push(progress.phase),
  }), { name: 'AbortError' })
  assert.equal(calls, 2)
  assert.equal(phases.includes('complete'), false)
})

test('handles empty accounts and rejects missing users or malicious archive URLs', async () => {
  assert.deepEqual(await importChessComGames('ada', { fetcher: async () => json({ archives: [] }) }), [])
  await assert.rejects(importChessComGames('ada', { fetcher: async () => json({}, 404) }), /not found/)
  await assert.rejects(importChessComGames('ada', { fetcher: async () => json({ archives: ['https://other.test/pub/player/ada/games/2025/01'] }) }), /unexpected archive/)
  assert.throws(() => normalizeUsername('../bad'), /username/)
})

test('retains variants and fails clearly on incomplete archive payloads', async () => {
  let calls = 0
  const games = await importChessComGames('ada', { fetcher: async () => ++calls === 1 ? json({ archives: [`${base}2025/01`] }) : json({ games: [{ ...rawGame(1), rules: 'chess960' }] }) })
  assert.equal(games[0].rules, 'chess960')
  calls = 0
  await assert.rejects(importChessComGames('ada', { fetcher: async () => ++calls === 1 ? json({ archives: [`${base}2025/01`] }) : json({ invalid: true }) }), /invalid game archive/)
})
