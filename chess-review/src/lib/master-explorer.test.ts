import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { createMasterExplorerClient, masterExplorerEligibility } from './master-explorer'

const fen = new Chess().fen()
function payload() {
  return {
    white: 50, draws: 30, black: 20,
    moves: [
      { uci: 'e2e4', san: 'untrusted', averageRating: 2450, white: 25, draws: 15, black: 10 },
      { uci: 'd2d4', san: 'untrusted', averageRating: 2500, white: 20, draws: 10, black: 5 },
    ],
    topGames: [{ uci: 'e2e4', id: 'AbCd1234', winner: 'white' as 'white' | 'black' | null, white: { name: 'White player', rating: 2600 }, black: { name: 'Black player', rating: 2550 }, year: 2020 }],
  }
}
const clientFor = (body: unknown, status = 200) => createMasterExplorerClient(async () => new Response(JSON.stringify(body), { status }))

test('a masters lookup sends only the selected standard FEN and fixed result limits without credentials', async () => {
  let requested = ''
  let init: RequestInit | undefined
  const lookup = createMasterExplorerClient(async (url, options) => {
    requested = String(url)
    init = options
    return new Response(JSON.stringify(payload()))
  })
  const selected = fen.replace('0 1', '5 30')
  const result = await lookup(selected)
  const url = new URL(requested)
  assert.equal(url.origin, 'https://explorer.lichess.org')
  assert.equal(url.pathname, '/masters')
  assert.equal(url.searchParams.get('fen'), selected)
  assert.deepEqual([...url.searchParams.keys()], ['fen', 'moves', 'topGames'])
  assert.equal(url.searchParams.get('moves'), '12')
  assert.equal(url.searchParams.get('topGames'), '5')
  assert.equal(init?.credentials, 'omit')
  assert.equal(init?.referrerPolicy, 'no-referrer')
  assert.equal(result.games, 100)
  assert.deepEqual(result.moves[0], { uci: 'e2e4', san: 'e4', averageRating: 2450, whiteWins: 25, draws: 15, blackWins: 10, games: 50 })
  assert.equal(result.topGames[0].san, 'e4')
  assert.equal(result.topGames[0].pgnUrl, 'https://explorer.lichess.org/masters/pgn/AbCd1234')
})

test('Chess960 and invalid positions never issue a request', async () => {
  let calls = 0
  const lookup = createMasterExplorerClient(async () => { calls++; throw new Error('Unexpected request') })
  assert.equal(masterExplorerEligibility(fen).eligible, true)
  assert.equal(masterExplorerEligibility(fen, 'chess960').eligible, false)
  assert.equal(masterExplorerEligibility(fen.replace('KQkq', 'HAha')).eligible, false)
  await assert.rejects(lookup(fen, { variant: 'chess960' }), /standard chess/)
  await assert.rejects(lookup('invalid FEN'), /valid standard/)
  assert.equal(calls, 0)
})

test('sparse and empty historical results are valid and do not invent moves or outcomes', async () => {
  const empty = await clientFor({ white: 0, draws: 0, black: 0, moves: [], topGames: [] })(fen)
  assert.equal(empty.games, 0)
  assert.deepEqual(empty.moves, [])
  assert.deepEqual(empty.topGames, [])
  const sparse = payload()
  sparse.moves = sparse.moves.slice(1)
  assert.equal((await clientFor(sparse)(fen)).moves.length, 1)
})

test('move legality and SAN are checked locally, including promotions', async () => {
  const position = '8/P6k/8/8/8/8/8/4K3 w - - 0 1'
  const data = { white: 1, draws: 1, black: 0, moves: [{ uci: 'a7a8n', san: 'a8=Q#', averageRating: 0, white: 0, draws: 1, black: 0 }], topGames: [] }
  assert.equal((await clientFor(data)(position)).moves[0].san, 'a8=N')
  const illegal = payload()
  illegal.moves[0].uci = 'e2e5'
  await assert.rejects(clientFor(illegal)(fen), /illegal or repeated/)
  const duplicate = payload()
  duplicate.moves[1] = duplicate.moves[0]
  await assert.rejects(clientFor(duplicate)(fen), /illegal or repeated/)
})

test('invalid, negative, fractional or overflowing totals and malformed details are rejected', async () => {
  for (const value of [-1, 1.5, '3', null, Infinity, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(clientFor({ ...payload(), white: value })(fen), /invalid statistics/)
  await assert.rejects(clientFor({ ...payload(), white: Number.MAX_SAFE_INTEGER })(fen), /invalid statistics/)
  const badMove = payload()
  badMove.moves[0].averageRating = -1
  await assert.rejects(clientFor(badMove)(fen), /invalid statistics/)
  const inconsistent = payload()
  inconsistent.moves[0].white = 1000
  await assert.rejects(clientFor(inconsistent)(fen), /inconsistent statistics/)
  for (const field of ['moves', 'topGames']) await assert.rejects(clientFor({ ...payload(), [field]: null })(fen), /incomplete response/)
  const badGame = payload()
  badGame.topGames[0].id = 'https://evil.example/'
  await assert.rejects(clientFor(badGame)(fen), /invalid game details/)
  const repeatedGame = payload()
  repeatedGame.topGames.push(repeatedGame.topGames[0])
  await assert.rejects(clientFor(repeatedGame)(fen), /invalid game details/)
  const badPlayer = payload()
  badPlayer.topGames[0].white.name = ''
  await assert.rejects(clientFor(badPlayer)(fen), /invalid game details/)
})

test('rate limits, permission failures, server errors and unreadable responses stay actionable', async () => {
  await assert.rejects(clientFor({}, 429)(fen), /rate limiting.*Wait a minute/)
  await assert.rejects(clientFor({}, 401)(fen), /denied this anonymous lookup/)
  await assert.rejects(clientFor({}, 503)(fen), /failed \(503\)/)
  await assert.rejects(createMasterExplorerClient(async () => new Response('{'))(fen), /unreadable data/)
  await assert.rejects(createMasterExplorerClient(async () => { throw new TypeError('Network') })(fen), /Check your connection/)
})

test('abort and timeout settle promptly even if fetch ignores cancellation', async () => {
  const lookup = createMasterExplorerClient(() => new Promise(() => {}), 20)
  const controller = new AbortController()
  const pending = lookup(fen, { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await assert.rejects(lookup(fen), /timed out/)
  await assert.rejects(lookup(fen, { signal: controller.signal }), { name: 'AbortError' })
})

test('cache results are isolated, expire after ten minutes and remain bounded to 32 positions', async () => {
  let calls = 0
  const lookup = createMasterExplorerClient(async () => { calls++; return new Response(JSON.stringify(payload())) })
  const first = await lookup(fen)
  first.moves[0].san = 'corrupt'
  first.topGames[0].white.name = 'corrupt'
  assert.equal((await lookup(fen)).moves[0].san, 'e4')
  assert.equal((await lookup(fen)).topGames[0].white.name, 'White player')
  assert.equal(calls, 1)
  for (let counter = 1; counter <= 32; counter++) await lookup(fen.replace('0 1', `${counter} 1`))
  await lookup(fen)
  assert.equal(calls, 34)
  const now = Date.now
  try {
    const current = now()
    Date.now = () => current + 600_001
    await lookup(fen)
    assert.equal(calls, 35)
  } finally { Date.now = now }
})

test('cancelled delayed responses cannot enter cache or overwrite a newer response', async () => {
  let finish: ((response: Response) => void) | undefined
  let calls = 0
  const lookup = createMasterExplorerClient(async () => {
    calls++
    if (calls === 1) return new Promise<Response>(resolve => { finish = resolve })
    return new Response(JSON.stringify({ ...payload(), white: 75 }))
  })
  const controller = new AbortController()
  const pending = lookup(fen, { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal((await lookup(fen)).whiteWins, 75)
  finish?.(new Response(JSON.stringify(payload())))
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal((await lookup(fen)).whiteWins, 75)
  assert.equal(calls, 2)
})
