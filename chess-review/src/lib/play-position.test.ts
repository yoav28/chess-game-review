import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { createPlayPosition, initialPlayPositionState, positionOutcome, type PlayPositionState } from './play-position'
import type { AnalysisOptions, PositionAnalysis } from '../engine/types'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness() {
  let state: PlayPositionState = initialPlayPositionState
  let events = 0
  const requests: { fen: string; options: AnalysisOptions; response: ReturnType<typeof deferred<PositionAnalysis>> }[] = []
  const player = createPlayPosition(value => { state = value; events++ }, {
    depth: 12, timeMs: 300,
    analyze: (fen, options = {}) => {
      const response = deferred<PositionAnalysis>()
      requests.push({ fen, options, response })
      return response.promise
    },
  })
  function answer(index: number, uci: string) {
    const request = requests[index]
    const board = new Chess(request.fen)
    const san = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
    request.response.resolve({
      fen: request.fen, bestMove: uci, bestMoveSan: san,
      evaluation: { cp: 0, mate: null }, pv: [uci], pvSan: [san], lines: [], depth: 12,
    })
  }
  return { player, requests, answer, get state() { return state }, get events() { return events } }
}

async function flush() {
  for (let index = 0; index < 6; index++) await Promise.resolve()
}

test('legal user moves receive an engine reply with complete history and Undo removes the pair', async () => {
  const view = harness()
  const initial = new Chess().fen()
  assert.equal(view.player.start(initial, 'w'), true)
  assert.equal(view.requests.length, 0)
  assert.equal(view.player.move('e2e5'), false)
  assert.equal(view.player.move('e7e5'), false)
  assert.equal(view.state.fen, initial)
  assert.equal(view.player.move('e2e4'), true)
  assert.equal(view.state.thinking, true)
  assert.equal(view.player.move('g1f3'), false)
  assert.deepEqual(view.requests[0].options.history, { initialFen: initial, moves: ['e2e4'] })
  assert.equal(view.requests[0].options.depth, 12)
  assert.equal(view.requests[0].options.timeMs, 300)
  view.answer(0, 'e7e5')
  await flush()
  assert.deepEqual(view.state.historySans, ['e4', 'e5'])
  assert.equal(view.state.turn, 'w')
  assert.equal(view.state.thinking, false)
  assert.deepEqual(view.state.lastMove, { from: 'e7', to: 'e5' })
  assert.equal(view.player.undo(), true)
  assert.equal(view.state.fen, initial)
  assert.deepEqual(view.state.historySans, [])
  assert.equal(view.state.canUndo, false)
  view.player.dispose()
})

test('playing Black automatically receives the first engine move and Undo preserves that opening reply', async () => {
  const view = harness()
  view.player.start(new Chess().fen(), 'b')
  assert.equal(view.state.thinking, true)
  view.answer(0, 'e2e4')
  await flush()
  const initialReplyFen = view.state.fen
  assert.equal(view.state.canUndo, false)
  assert.equal(view.player.move('e7e5'), true)
  view.answer(1, 'g1f3')
  await flush()
  assert.deepEqual(view.state.historySans, ['e4', 'e5', 'Nf3'])
  assert.equal(view.player.undo(), true)
  assert.equal(view.state.fen, initialReplyFen)
  assert.deepEqual(view.state.historySans, ['e4'])
  assert.equal(view.state.turn, 'b')
  view.player.dispose()
})

test('Undo while the engine thinks aborts the request and ignores its stale reply', async () => {
  const view = harness()
  const initial = new Chess().fen()
  view.player.start(initial, 'w')
  view.player.move('e2e4')
  assert.equal(view.player.undo(), true)
  assert.equal(view.requests[0].options.signal?.aborted, true)
  const events = view.events
  view.answer(0, 'e7e5')
  await flush()
  assert.equal(view.state.fen, initial)
  assert.equal(view.state.thinking, false)
  assert.equal(view.events, events)
  view.player.dispose()
})

test('starting another position and stopping cannot be overwritten by an older engine result', async () => {
  const view = harness()
  const board = new Chess()
  view.player.start(board.fen(), 'w')
  view.player.move('e2e4')
  board.move('d4')
  view.player.start(board.fen(), 'b')
  assert.equal(view.requests[0].options.signal?.aborted, true)
  const events = view.events
  view.answer(0, 'e7e5')
  await flush()
  assert.equal(view.state.fen, board.fen())
  assert.equal(view.events, events)
  view.player.move('d7d5')
  view.player.stop()
  const stopped = view.events
  assert.equal(view.requests[1].options.signal?.aborted, true)
  view.requests[1].response.reject(new Error('old failure'))
  await flush()
  assert.equal(view.state.active, false)
  assert.equal(view.state.error, '')
  assert.equal(view.events, stopped)
  view.player.dispose()
})

test('prior history is retained for threefold draws and Restart returns to the selected position', () => {
  const view = harness()
  const board = new Chess()
  const initialFen = board.fen()
  const moves = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1']
  for (const uci of moves) board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) })
  const selected = board.fen()
  view.player.start(selected, 'b', { initialFen, moves })
  assert.equal(view.player.move('f6g8'), true)
  assert.equal(view.state.outcome, 'Draw by threefold repetition.')
  assert.deepEqual(view.state.historySans, ['Ng8'])
  assert.equal(view.requests.length, 0)
  view.player.restart()
  assert.equal(view.state.fen, selected)
  assert.equal(view.state.outcome, null)
  assert.deepEqual(view.state.historySans, [])
  view.player.dispose()
})

test('promotion requires an explicit legal piece and an underpromotion draw stops engine play', () => {
  const view = harness()
  const fen = '8/P6k/8/8/8/8/8/4K3 w - - 0 1'
  view.player.start(fen, 'w')
  assert.equal(view.player.move('a7a8'), false)
  assert.equal(view.state.fen, fen)
  assert.equal(view.player.move('a7a8n'), true)
  assert.deepEqual(view.state.historySans, ['a8=N'])
  assert.equal(view.state.outcome, 'Draw by insufficient material.')
  assert.equal(view.requests.length, 0)
  assert.equal(view.player.undo(), true)
  assert.equal(view.state.fen, fen)
  view.player.dispose()
})

test('checkmate and terminal starting positions never ask the engine for another move', () => {
  const view = harness()
  const board = new Chess()
  board.loadPgn('1. f3 e5 2. g4 *')
  view.player.start(board.fen(), 'b')
  assert.equal(view.player.move('d8h4'), true)
  assert.equal(view.state.outcome, 'Black wins by checkmate.')
  assert.equal(view.requests.length, 0)
  assert.equal(view.player.move('a2a3'), false)
  view.player.start('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1', 'w')
  assert.equal(view.state.outcome, 'Draw by stalemate.')
  assert.equal(view.requests.length, 0)
  assert.equal(positionOutcome(new Chess()), null)
  view.player.dispose()
})

test('settings and side changes abort stale analysis and apply to the new engine turn', async () => {
  const view = harness()
  view.player.start(new Chess().fen(), 'w')
  view.player.move('e2e4')
  view.player.configure(20, 1200)
  assert.equal(view.requests[0].options.signal?.aborted, true)
  assert.equal(view.requests[1].options.depth, 20)
  assert.equal(view.requests[1].options.timeMs, 1200)
  view.player.setPlayerColor('b')
  assert.equal(view.requests[1].options.signal?.aborted, true)
  assert.equal(view.state.thinking, false)
  assert.equal(view.player.move('e7e5'), true)
  view.answer(0, 'c7c5')
  view.answer(1, 'e7e6')
  await flush()
  assert.deepEqual(view.state.historySans, ['e4', 'e5'])
  view.answer(2, 'g1f3')
  await flush()
  assert.deepEqual(view.state.historySans, ['e4', 'e5', 'Nf3'])
  assert.equal(view.state.playerColor, 'b')
  assert.equal(view.state.turn, 'b')
  view.player.dispose()
})

test('engine failures can be retried and unmount suppresses all late replies', async () => {
  const view = harness()
  view.player.start(new Chess().fen(), 'b')
  view.requests[0].response.reject(new Error('Engine unavailable'))
  await flush()
  assert.equal(view.state.error, 'Engine unavailable')
  assert.equal(view.state.thinking, false)
  view.player.retry()
  assert.equal(view.state.error, '')
  assert.equal(view.state.thinking, true)
  view.player.dispose()
  const events = view.events
  view.answer(1, 'e2e4')
  await flush()
  assert.equal(view.requests[1].options.signal?.aborted, true)
  assert.equal(view.events, events)
  assert.equal(view.player.move('e2e4'), false)
})

test('invalid FEN and mismatched histories fail visibly without starting an engine', () => {
  const view = harness()
  assert.equal(view.player.start('not a position', 'w'), false)
  assert.equal(view.state.active, false)
  assert.ok(view.state.error)
  const fen = new Chess().fen()
  assert.equal(view.player.start(fen, 'w', { initialFen: fen, moves: ['e2e4'] }), false)
  assert.match(view.state.error, /does not match/)
  assert.equal(view.requests.length, 0)
  view.player.dispose()
})
