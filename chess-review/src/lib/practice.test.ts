import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { assessPracticeAttempt, createPracticeReview, initialPracticeState, practiceMoves, type PracticeState } from './practice'
import { buildReview, parsePgn, type GameReview } from './review'
import type { AnalysisOptions, Evaluation, PositionAnalysis } from '../engine/types'
import type { analyzePosition } from '../engine/stockfish'

function analysis(fen: string, evaluation: Evaluation, best?: string): PositionAnalysis {
  const board = new Chess(fen)
  const first = board.moves({ verbose: true })[0]
  const bestMove = best ?? (first ? `${first.from}${first.to}${first.promotion ?? ''}` : null)
  return { fen, evaluation, bestMove, bestMoveSan: null, pv: [], pvSan: [], depth: 12, lines: [] }
}

function fixture(pgn = '1. e4 e5 2. Nf3 Nc6 *', index = 2, best = 'Bc4') {
  const game = parsePgn(pgn)
  const review = buildReview(game, [game.initialFen, ...game.moves.map(move => move.afterFen)].map(fen => analysis(fen, { cp: 0, mate: null })))
  const move = review.moves[index]
  const board = new Chess(move.beforeFen)
  const played = board.move(best)
  Object.assign(move, { classification: 'mistake', bestMove: `${played.from}${played.to}${played.promotion ?? ''}`, bestMoveSan: played.san })
  return { review, move }
}

function engine(before: Evaluation, after: Evaluation, best = 'f1c4') {
  const calls: { fen: string; options: AnalysisOptions }[] = []
  const analyze: typeof analyzePosition = async (fen, options = {}) => {
    calls.push({ fen, options })
    return analysis(fen, calls.length === 1 ? before : after, calls.length === 1 ? best : undefined)
  }
  return { analyze, calls }
}

test('a different legal move within tolerance is accepted using matched budgets and complete game history', async () => {
  const { review, move } = fixture()
  const mocked = engine({ cp: 100, mate: null }, { cp: 80, mate: null })
  const result = await assessPracticeAttempt(review, move, 'b1c3', { depth: 18, timeMs: 700 }, mocked.analyze)
  assert.equal(result.accepted, true)
  assert.equal(result.san, 'Nc3')
  assert.match(result.feedback, /\+1\.00 → \+0\.80/)
  assert.match(result.feedback, /depth 18, 700 ms per position; reached depths 12\/12/)
  assert.match(result.feedback, /Engine first choice: Bc4/)
  assert.deepEqual(mocked.calls.map(call => call.options.history?.moves), [['e2e4', 'e7e5'], ['e2e4', 'e7e5', 'b1c3']])
  assert.deepEqual(mocked.calls.map(call => [call.options.depth, call.options.timeMs, call.options.multiPv]), [[18, 700, 1], [18, 700, 1]])
})

test('a materially worse legal attempt reports its actual SAN, evaluations, and engine choice', async () => {
  const { review, move } = fixture()
  const mocked = engine({ cp: 80, mate: null }, { cp: -180, mate: null })
  const result = await assessPracticeAttempt(review, move, 'f2f3', {}, mocked.analyze)
  assert.equal(result.accepted, false)
  assert.match(result.feedback, /^f3 /)
  assert.match(result.feedback, /\+0\.80 → -1\.80/)
  assert.match(result.feedback, /loss 2\.6 pawns/)
  assert.match(result.feedback, /search estimate/)
})

test('Black’s alternative is compared from Black’s perspective', async () => {
  const { review, move } = fixture('1. e4 e5 *', 1, 'c5')
  assert.equal((await assessPracticeAttempt(review, move, 'e7e6', {}, engine({ cp: -100, mate: null }, { cp: -80, mate: null }, 'c7c5').analyze)).accepted, true)
  assert.equal((await assessPracticeAttempt(review, move, 'e7e6', {}, engine({ cp: -100, mate: null }, { cp: 120, mate: null }, 'c7c5').analyze)).accepted, false)
})

test('the equivalence threshold accepts 30 centipawns but rejects 31', async () => {
  const { review, move } = fixture()
  assert.equal((await assessPracticeAttempt(review, move, 'b1c3', {}, engine({ cp: 0, mate: null }, { cp: -30, mate: null }).analyze)).accepted, true)
  assert.equal((await assessPracticeAttempt(review, move, 'b1c3', {}, engine({ cp: 0, mate: null }, { cp: -31, mate: null }).analyze)).accepted, false)
})

test('the legal saved first choice is accepted without starting an engine', async () => {
  const { review, move } = fixture()
  const result = await assessPracticeAttempt(review, move, 'f1c4', {}, async () => { throw new Error('Engine must not run') })
  assert.equal(result.accepted, true)
  assert.match(result.feedback, /saved engine first choice/)
})

test('illegal attempts and corrupt prefix histories never reach the engine', async () => {
  const { review, move } = fixture()
  const mocked = engine({ cp: 0, mate: null }, { cp: 0, mate: null })
  await assert.rejects(assessPracticeAttempt(review, move, 'e1e8', {}, mocked.analyze), /Invalid move/)
  review.moves[0].uci = 'e2e3'
  await assert.rejects(assessPracticeAttempt(review, move, 'b1c3', {}, mocked.analyze), /history does not match/)
  assert.equal(mocked.calls.length, 0)
})

test('mate preservation is required even when the reported centipawn difference is small', async () => {
  const { review, move } = fixture()
  const losesMate = engine({ cp: 500, mate: 4 }, { cp: 495, mate: null })
  assert.equal((await assessPracticeAttempt(review, move, 'b1c3', {}, losesMate.analyze)).accepted, false)
  const keepsMate = engine({ cp: 99995, mate: 5 }, { cp: 99993, mate: 7 })
  assert.equal((await assessPracticeAttempt(review, move, 'b1c3', {}, keepsMate.analyze)).accepted, true)
})

test('immediate mating attempts use the real terminal result even if an injected engine score is stale', async () => {
  const { review, move } = fixture('1. f3 e5 2. g4 Nc6 *', 3, 'Bc5')
  const mocked = engine({ cp: -99997, mate: -3 }, { cp: 0, mate: null }, 'f8c5')
  const result = await assessPracticeAttempt(review, move, 'd8h4', {}, mocked.analyze)
  assert.equal(result.accepted, true)
  assert.equal(result.san, 'Qh4#')
  assert.match(result.feedback, /checkmate \(Black wins\)/)
})

test('pre-aborted and mid-analysis-aborted attempts do not continue or grade', async () => {
  const { review, move } = fixture()
  const controller = new AbortController()
  controller.abort()
  const mocked = engine({ cp: 0, mate: null }, { cp: 0, mate: null })
  await assert.rejects(assessPracticeAttempt(review, move, 'b1c3', { signal: controller.signal }, mocked.analyze), { name: 'AbortError' })
  assert.equal(mocked.calls.length, 0)
  const mid = new AbortController()
  await assert.rejects(assessPracticeAttempt(review, move, 'b1c3', { signal: mid.signal }, async fen => {
    mid.abort()
    return analysis(fen, { cp: 0, mate: null }, 'f1c4')
  }), { name: 'AbortError' })
})

test('practice selection preserves the chosen color, explicit ply selects its own color and index, and next signals completion', () => {
  const { review } = fixture()
  const black = review.moves[1]
  Object.assign(black, { classification: 'mistake', bestMove: 'c7c5' })
  let state: PracticeState = initialPracticeState
  const service = createPracticeReview(value => { state = value }, { review })
  service.setColor('b')
  service.begin()
  assert.equal(state.practiceColor, 'b')
  assert.equal(state.retry, black)
  service.begin(3)
  assert.equal(state.practiceColor, 'w')
  assert.equal(state.retry?.ply, 3)
  service.showHint()
  assert.equal(state.hint, true)
  service.showSolution()
  assert.equal(state.practiceStatus, 'revealed')
  assert.equal(service.next(), true)
  assert.equal(state.practiceFen, null)
})

test('pending analysis is canceled and stale responses discarded after stop, next, color, review, settings, solution, or disposal', async () => {
  for (const action of ['stop', 'next', 'color', 'review', 'settings', 'solution', 'dispose']) {
    const { review, move } = fixture()
    let state = initialPracticeState
    let emissions = 0
    let signal: AbortSignal | undefined
    let finish!: (result: PositionAnalysis) => void
    const service = createPracticeReview(value => { state = value; emissions++ }, { review, analyze: async (_fen, options) => {
      signal = options?.signal
      return new Promise(resolve => { finish = resolve })
    } })
    service.begin(3)
    const attempt = service.attempt('b1c3')
    assert.equal(state.practiceBusy, true)
    if (action === 'stop') service.stop()
    if (action === 'next') service.next()
    if (action === 'color') service.setColor('b')
    if (action === 'review') service.configure({ ...review }, 16, 500)
    if (action === 'settings') service.configure(review, 20, 1000)
    if (action === 'solution') service.showSolution()
    if (action === 'dispose') service.dispose()
    const count = emissions
    assert.equal(signal?.aborted, true, action)
    finish(analysis(move.beforeFen, { cp: 0, mate: null }, 'f1c4'))
    await attempt
    assert.equal(emissions, count, action)
    if (action !== 'dispose') assert.equal(state.practiceBusy, false, action)
    if (action === 'solution') assert.equal(state.practiceStatus, 'revealed')
  }
})

test('corrupt stored moves and principal variations do not crash selection or cause false successes', async () => {
  const { review, move } = fixture()
  move.pv = ['broken']
  move.pvSan = ['fiction']
  const mocked = engine({ cp: 0, mate: null }, { cp: -200, mate: null })
  assert.equal((await assessPracticeAttempt(review, move, 'b1c3', {}, mocked.analyze)).accepted, false)
  move.bestMove = 'e1e8'
  assert.equal(practiceMoves(review, 'all').length, 0)
  assert.deepEqual(practiceMoves({ ...review, moves: [null] } as unknown as GameReview, 'all'), [])
})

test('a stale after-position result cannot replace a newer successful attempt', async () => {
  const { review, move } = fixture()
  let state = initialPracticeState
  let calls = 0
  let finish!: (result: PositionAnalysis) => void
  const service = createPracticeReview(value => { state = value }, { review, analyze: async fen => {
    calls++
    if (calls === 1) return analysis(fen, { cp: 0, mate: null }, 'f1c4')
    return new Promise(resolve => { finish = resolve })
  } })
  service.begin(3)
  const previous = service.attempt('b1c3')
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(calls, 2)
  service.begin(3)
  await service.attempt('f1c4')
  const accepted = state
  assert.equal(accepted.practiceStatus, 'solved')
  const board = new Chess(move.beforeFen)
  board.move('Nc3')
  finish(analysis(board.fen(), { cp: -500, mate: null }))
  await previous
  assert.equal(state, accepted)
})
