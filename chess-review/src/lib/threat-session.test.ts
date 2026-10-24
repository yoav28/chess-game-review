import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import type { AnalysisOptions, PositionAnalysis } from '../engine/types'
import { createThreatSession, initialThreatState, type ThreatContext } from './threat-session'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function harness(initial: Partial<ThreatContext> = {}) {
  const context: ThreatContext = { fen: new Chess().fen(), enabled: true, depth: 12, timeMs: 300, ...initial }
  let state = initialThreatState
  let events = 0
  const requests: { fen: string; options: AnalysisOptions; response: ReturnType<typeof deferred<PositionAnalysis>> }[] = []
  const service = createThreatSession(value => { state = value; events++ }, context, (fen, options = {}) => {
    const response = deferred<PositionAnalysis>()
    requests.push({ fen, options, response })
    return response.promise
  })
  function answer(index: number, pv = ['e7e5']) {
    const request = requests[index]
    request.response.resolve({ fen: request.fen, variant: request.options.variant, bestMove: pv[0] ?? null, bestMoveSan: null, pv, pvSan: [], depth: 12, evaluation: { cp: 0, mate: null }, lines: [] })
  }
  return { service, requests, context, answer, get state() { return state }, get events() { return events } }
}
async function flush() { for (let count = 0; count < 8; count++) await Promise.resolve() }

test('threat analysis only starts explicitly in an enabled Analysis context', async () => {
  const view = harness({ enabled: false })
  assert.equal(view.requests.length, 0)
  await view.service.show()
  assert.equal(view.requests.length, 0)
  view.service.configure({ ...view.context, enabled: true })
  assert.equal(view.requests.length, 0)
  const pending = view.service.show()
  assert.equal(view.state.running, true)
  assert.equal(view.state.active, true)
  assert.equal(view.requests.length, 1)
  view.answer(0)
  await pending
  assert.equal(view.state.running, false)
  assert.equal(view.state.result?.firstMove?.san, 'e5')
})

test('actual-position changes abort and clear the feature without starting another null-position search', async () => {
  const view = harness()
  const pending = view.service.show()
  const board = new Chess()
  board.move('e4')
  view.service.configure({ ...view.context, fen: board.fen() })
  assert.equal(view.requests[0].options.signal?.aborted, true)
  assert.equal(view.state.active, false)
  assert.equal(view.state.result, null)
  const events = view.events
  view.answer(0)
  await pending
  assert.equal(view.events, events)
  assert.equal(view.requests.length, 1)
})

test('new requests own their result and hiding prevents stale successes or errors from resurfacing', async () => {
  const view = harness()
  const old = view.service.show()
  const current = view.service.show()
  assert.equal(view.requests[0].options.signal?.aborted, true)
  view.answer(1, ['d7d5'])
  await current
  assert.equal(view.state.result?.firstMove?.san, 'd5')
  view.answer(0)
  await old
  assert.equal(view.state.result?.firstMove?.san, 'd5')
  const pending = view.service.show()
  view.service.hide()
  const events = view.events
  view.requests[2].response.reject(new Error('stale error'))
  await pending
  assert.equal(view.events, events)
  assert.deepEqual(view.state, initialThreatState)
})

test('a variant change invalidates an in-flight result even when the displayed FEN is unchanged', async () => {
  const view = harness({ variant: 'chess' })
  const pending = view.service.show()
  view.service.configure({ ...view.context, variant: 'chess960' })
  assert.equal(view.requests[0].options.signal?.aborted, true)
  assert.equal(view.state.active, false)
  const events = view.events
  view.answer(0)
  await pending
  assert.equal(view.events, events)
  assert.equal(view.state.result, null)
})

test('budget changes replace active workers and disabled or unmounted sessions ignore pending output', async () => {
  const view = harness()
  const old = view.service.show()
  view.service.configure({ ...view.context, depth: 18, timeMs: 1500 })
  assert.equal(view.requests[0].options.signal?.aborted, true)
  assert.equal(view.requests[1].options.depth, 18)
  assert.equal(view.requests[1].options.timeMs, 1500)
  view.service.configure({ ...view.context, enabled: false })
  assert.equal(view.requests[1].options.signal?.aborted, true)
  view.answer(0)
  view.answer(1)
  await old
  await flush()
  assert.equal(view.state.result, null)
  view.service.configure(view.context)
  const pending = view.service.show()
  view.service.dispose()
  const events = view.events
  view.answer(2)
  await pending
  assert.equal(view.events, events)
  await view.service.show()
  assert.equal(view.requests.length, 3)
})

test('invalid positions and failed searches surface honest errors and empty PV yields no invented threat', async () => {
  const checked = harness({ fen: '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1' })
  await checked.service.show()
  assert.equal(checked.requests.length, 0)
  assert.match(checked.state.error, /in check/)
  const view = harness()
  const failing = view.service.show()
  view.requests[0].response.reject(new Error('Engine unavailable'))
  await failing
  assert.match(view.state.error, /Engine unavailable/)
  const pending = view.service.show()
  view.answer(1, [])
  await pending
  assert.equal(view.state.error, '')
  assert.equal(view.state.result?.firstMove, null)
  assert.equal(view.state.result?.arrow, null)
})
