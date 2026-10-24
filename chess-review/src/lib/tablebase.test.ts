import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { createTablebaseClient, tablebaseEligibility, type TablebaseCategory } from './tablebase'

const fen = '4k3/6KP/8/8/8/8/7p/8 w - - 0 1'
function payload(position = fen) {
  return { category: 'win', dtz: 1, precise_dtz: 1, moves: new Chess(position).moves({ verbose: true }).map(move => ({
    uci: `${move.from}${move.to}${move.promotion ?? ''}`, san: 'untrusted SAN', category: 'loss', dtz: -2, precise_dtz: -2,
  })) }
}
function clientFor(body: unknown, status = 200) {
  return createTablebaseClient(async () => new Response(JSON.stringify(body), { status }))
}

test('tablebases accept seven or fewer pieces, reject castling and invalid positions before requesting', async () => {
  assert.equal(tablebaseEligibility(fen).eligible, true)
  assert.equal(tablebaseEligibility('4k3/8/8/8/8/8/PPPP4/R3K3 w - - 0 1').eligible, true)
  assert.equal(tablebaseEligibility('4k3/8/8/8/8/8/PPPPP3/R3K3 w - - 0 1').eligible, false)
  assert.match(tablebaseEligibility('4k3/8/8/8/8/8/8/4K2R w K - 0 1').reason, /castling/)
  let requested = false
  const probe = createTablebaseClient(async () => { requested = true; throw new Error('unexpected request') })
  await assert.rejects(probe('invalid'), /valid standard chess position/)
  await assert.rejects(probe(new Chess().fen()), /seven or fewer/)
  assert.equal(requested, false)
})

test('request includes selected full FEN counters and excludes credentials; legal SAN is generated locally', async () => {
  let requested = ''
  let init: RequestInit | undefined
  const position = fen.replace('0 1', '97 50')
  const probe = createTablebaseClient(async (url, options) => {
    requested = String(url)
    init = options
    return new Response(JSON.stringify(payload(position)))
  })
  const result = await probe(position)
  const url = new URL(requested)
  assert.equal(url.origin, 'https://tablebase.lichess.ovh')
  assert.equal(url.pathname, '/standard')
  assert.equal(url.searchParams.get('fen'), new Chess(position).fen())
  assert.deepEqual([...url.searchParams.keys()], ['fen'])
  assert.equal(init?.credentials, 'omit')
  assert.equal(init?.referrerPolicy, 'no-referrer')
  assert.equal(result.turn, 'w')
  assert.equal(result.category, 'win')
  assert.equal(result.dtz, 1)
  assert.equal(result.moves.find(move => move.uci === 'h7h8q')?.san, 'h8=Q+')
  assert.equal(result.moves[0].category, 'win')
  assert.equal(result.moves[0].afterDtz, -2)
})

test('move outcomes reverse side-relative categories including rule-dependent and uncertain results', async () => {
  const categories: TablebaseCategory[] = ['win', 'loss', 'draw', 'cursed-win', 'blessed-loss', 'syzygy-win', 'syzygy-loss', 'maybe-win', 'maybe-loss', 'unknown']
  const expected: TablebaseCategory[] = ['loss', 'win', 'draw', 'blessed-loss', 'cursed-win', 'syzygy-loss', 'syzygy-win', 'maybe-loss', 'maybe-win', 'unknown']
  for (let i = 0; i < categories.length; i += 1) {
    const data = payload()
    data.category = categories[i]
    data.moves[0].category = categories[i]
    const result = await clientFor(data)(fen)
    assert.equal(result.category, categories[i])
    assert.equal(result.moves[0].category, expected[i])
  }
})

test('unknown and rounded distances remain explicit and never become engine scores', async () => {
  const data = { ...payload(), dtz: null, precise_dtz: null }
  const result = await clientFor(data)(fen)
  assert.equal(result.dtz, null)
  assert.equal(result.preciseDtz, null)
  assert.equal(Object.hasOwn(result, 'score'), false)
  const rounded = await clientFor({ ...payload(), dtz: 4, precise_dtz: null })(fen)
  assert.equal(rounded.dtz, 4)
  assert.equal(rounded.preciseDtz, null)
})

test('rejects illegal or duplicate moves, missing legal moves, unknown categories and invalid metrics', async () => {
  const illegal = payload()
  illegal.moves[0].uci = 'a1a8'
  await assert.rejects(clientFor(illegal)(fen), /invalid or repeated move/)
  const repeated = payload()
  repeated.moves[1] = repeated.moves[0]
  await assert.rejects(clientFor(repeated)(fen), /invalid or repeated move/)
  const partial = payload()
  partial.moves.pop()
  await assert.rejects(clientFor(partial)(fen), /incomplete move list/)
  await assert.rejects(clientFor({ ...payload(), category: '__proto__' })(fen), /unrecognized result/)
  await assert.rejects(clientFor({ ...payload(), dtz: 'mate' })(fen), /invalid distance/)
  await assert.rejects(clientFor({ ...payload(), moves: null })(fen), /legal moves/)
})

test('locally verified terminal positions permit empty moves without inventing continuations', async () => {
  const position = '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1'
  const result = await clientFor({ category: 'loss', dtz: -1, precise_dtz: -1, moves: [] })(position)
  assert.equal(result.checkmate, true)
  assert.equal(result.turn, 'b')
  assert.deepEqual(result.moves, [])
})

test('rate limits, unavailable tables, server errors, malformed JSON and network errors are actionable', async () => {
  await assert.rejects(clientFor({}, 429)(fen), /rate limiting.*Wait a minute/)
  await assert.rejects(clientFor({}, 404)(fen), /required tablebase is unavailable/)
  await assert.rejects(clientFor({}, 503)(fen), /failed \(503\)/)
  await assert.rejects(createTablebaseClient(async () => new Response('{'))(fen), /unreadable data/)
  await assert.rejects(createTablebaseClient(async () => { throw new TypeError('network') })(fen), /Check your connection/)
})

test('cancellation and timeouts settle even when an HTTP implementation ignores AbortSignal', async () => {
  const hanging = createTablebaseClient(() => new Promise(() => {}), 20)
  const controller = new AbortController()
  const pending = hanging(fen, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await assert.rejects(hanging(fen), /timed out/)
  await assert.rejects(hanging(fen, controller.signal), { name: 'AbortError' })
})

test('successful probes are cached by full FEN, returned values are isolated, and cache stays bounded', async () => {
  let requests = 0
  const probe = createTablebaseClient(async url => {
    requests += 1
    const position = new URL(String(url)).searchParams.get('fen')!
    return new Response(JSON.stringify(payload(position)))
  })
  const first = await probe(fen)
  first.moves[0].san = 'tampered'
  assert.notEqual((await probe(fen)).moves[0].san, 'tampered')
  assert.equal(requests, 1)
  for (let clock = 1; clock <= 64; clock += 1) await probe(fen.replace('0 1', `${clock} 1`))
  await probe(fen)
  assert.equal(requests, 66)
})

test('aborted delayed responses never enter cache or replace a newer request', async () => {
  let finish: ((response: Response) => void) | undefined
  let requests = 0
  const probe = createTablebaseClient(async () => {
    requests += 1
    if (requests === 1) return new Promise<Response>(resolve => { finish = resolve })
    return new Response(JSON.stringify(payload()))
  })
  const controller = new AbortController()
  const pending = probe(fen, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  finish?.(new Response(JSON.stringify(payload())))
  await new Promise(resolve => setTimeout(resolve, 0))
  await probe(fen)
  assert.equal(requests, 2)
})
