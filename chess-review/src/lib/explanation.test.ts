import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { buildExplanationSteps } from './explanation'
import { createExplanationPlayback, initialExplanationState, type ExplanationOptions } from './explanation-playback'
import { parsePgn, type MoveReview } from './review'

function reviewedMove(overrides: Partial<MoveReview> = {}): MoveReview {
  return {
    ...parsePgn('1. a3 *').moves[0], classification: 'inaccuracy', centipawnLoss: 70,
    accuracy: 75, beforeEvaluation: { cp: 30, mate: null }, evaluation: { cp: -40, mate: null },
    bestMove: 'e2e4', bestMoveSan: 'e4', pv: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
    pvSan: ['untrusted', 'untrusted'], depth: 15, phase: 'opening',
    explanation: 'a3 moves the pawn to a3. e4 was the engine’s first choice.', ...overrides,
  }
}

function harness(reducedMotion = false, options: ExplanationOptions = {}) {
  let state = initialExplanationState
  let events = 0
  const timers: { callback: () => void; delay: number; cancelled: boolean }[] = []
  const playback = createExplanationPlayback(value => { state = value; events++ }, {
    ...options,
    reducedMotion: () => reducedMotion,
    schedule: (callback, delay) => {
      const timer = { callback, delay, cancelled: false }
      timers.push(timer)
      return () => { timer.cancelled = true }
    },
  })
  return { playback, timers, get state() { return state }, get events() { return events } }
}

test('explanations separate the played move from the engine branch with an explicit position reset', () => {
  const move = reviewedMove()
  const steps = buildExplanationSteps(move)
  assert.deepEqual(steps.map(step => step.stage), ['position', 'played', 'alternative', 'continuation', 'continuation', 'continuation', 'continuation'])
  assert.equal(steps[0].fen, move.beforeFen)
  assert.equal(steps[1].fen, move.afterFen)
  assert.equal(steps[1].san, 'a3')
  assert.equal(steps[2].fen, move.beforeFen)
  assert.equal(steps[2].uci, undefined)
  assert.match(steps[2].caption, /before a3.*preferred e4/)
  const branch = new Chess(move.beforeFen)
  for (const step of steps.slice(3)) {
    const played = branch.move({ from: step.uci!.slice(0, 2), to: step.uci!.slice(2, 4) })
    assert.equal(step.fen, branch.fen())
    assert.equal(step.san, played.san)
    assert.ok(step.caption.includes(played.san))
  }
  assert.equal(branch.get('a2')?.type, 'p')
  assert.equal(branch.get('a3'), undefined)
})

test('a best move uses its played position before continuing and SAN is verified from legal moves', () => {
  const move = reviewedMove({ ...parsePgn('1. e4 *').moves[0], explanation: 'e4 controls the center.' })
  const steps = buildExplanationSteps(move)
  assert.deepEqual(steps.map(step => step.san), ['', 'e4', 'e5', 'Nf3', 'Nc6'])
  assert.equal(steps.some(step => step.stage === 'alternative'), false)
  assert.match(steps[3].caption, /knight develops/)
  assert.ok(steps.every(step => !step.caption.includes('untrusted')))
})

test('invalid PV tails stop at the last legal move and mismatched branches are never attached', () => {
  const steps = buildExplanationSteps(reviewedMove({ pv: ['e2e4', 'e7e5', 'a1a8', 'b8c6'] }))
  assert.deepEqual(steps.filter(step => step.uci).map(step => step.uci), ['a2a3', 'e2e4', 'e7e5'])
  const mismatch = buildExplanationSteps(reviewedMove({ pv: ['d2d4', 'd7d5'] }))
  assert.deepEqual(mismatch.filter(step => step.uci).map(step => step.uci), ['a2a3', 'e2e4'])
  assert.equal(buildExplanationSteps(reviewedMove({ bestMove: 'e2e5' })).length, 2)
  assert.equal(buildExplanationSteps(reviewedMove({ bestMove: null })).length, 2)
})

test('the best-play demonstration is capped at eight legal half-moves', () => {
  const steps = buildExplanationSteps(reviewedMove({
    pv: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1'],
  }))
  assert.equal(steps.filter(step => step.stage === 'continuation').length, 8)
  assert.equal(steps.at(-1)?.san, 'Nf6')
})

test('promotion and mate notation come from the board rather than saved SAN', () => {
  const fen = '8/P6k/8/8/8/8/8/4K3 w - - 0 1'
  const move = parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. a8=Q *`).moves[0]
  const steps = buildExplanationSteps(reviewedMove({ ...move, bestMove: 'a7a8n', pv: ['a7a8n'], bestMoveSan: 'a8=Q' }))
  assert.equal(steps.at(-1)?.san, 'a8=N')
  assert.match(steps.at(-1)!.caption, /promotes to a knight/)
  assert.equal(new Chess(steps.at(-1)!.fen).get('a8')?.type, 'n')
  const mate = parsePgn('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# *').moves.at(-1)!
  const mateSteps = buildExplanationSteps(reviewedMove({ ...mate, san: 'Qxf7', bestMove: mate.uci, pv: [mate.uci, 'h8g8'] }))
  assert.equal(mateSteps.at(-1)?.san, 'Qxf7#')
  assert.equal(new Chess(mateSteps.at(-1)!.fen).isCheckmate(), true)
})

test('playback runs every 1.3 seconds and stops at the final step', () => {
  const view = harness()
  assert.equal(view.playback.start(reviewedMove()), true)
  assert.equal(view.state.playing, true)
  assert.equal(view.timers[0].delay, 1300)
  for (let index = 0; index < view.state.steps.length - 1; index++) view.timers[index].callback()
  assert.equal(view.state.currentStep, view.state.steps.length - 1)
  assert.equal(view.state.playing, false)
  assert.deepEqual(view.state.lastMove, { from: 'b8', to: 'c6' })
  view.playback.play()
  assert.equal(view.state.currentStep, 0)
  assert.equal(view.state.playing, true)
  view.playback.dispose()
})

test('reduced motion starts manually and stepping, pause, reset and stop cancel pending playback', () => {
  const view = harness(true)
  view.playback.start(reviewedMove())
  assert.equal(view.state.playing, false)
  assert.equal(view.timers.length, 0)
  view.playback.next()
  assert.equal(view.state.currentStep, 1)
  view.playback.previous()
  assert.equal(view.state.currentStep, 0)
  view.playback.play()
  view.playback.pause()
  assert.equal(view.timers[0].cancelled, true)
  view.timers[0].callback()
  assert.equal(view.state.currentStep, 0)
  view.playback.next()
  view.playback.reset()
  assert.equal(view.state.currentStep, 0)
  assert.equal(view.state.lastMove, undefined)
  view.playback.play()
  view.playback.stop()
  view.timers[1].callback()
  assert.equal(view.state.active, false)
  assert.equal(view.state.steps.length, 0)
})

test('changing moves and unmounting suppress stale timers and invalid data fails safely', () => {
  const view = harness()
  view.playback.start(reviewedMove())
  view.playback.start(reviewedMove({ ...parsePgn('1. d4 *').moves[0] }))
  assert.equal(view.timers[0].cancelled, true)
  view.timers[0].callback()
  assert.equal(view.state.currentStep, 0)
  view.playback.dispose()
  const events = view.events
  view.timers[1].callback()
  assert.equal(view.events, events)
  assert.equal(view.playback.start(reviewedMove()), false)
  view.playback.activate()
  assert.equal(view.playback.start(reviewedMove({ beforeFen: 'invalid' })), false)
  assert.equal(view.state.active, false)
  assert.match(view.state.error, /invalid/)
})

test('autoplay preferences apply to new explanations without preventing explicit playback', () => {
  const view = harness(false, { autoplay: false, delayMs: 2000 })
  view.playback.start(reviewedMove())
  assert.equal(view.state.playing, false)
  assert.equal(view.timers.length, 0)
  view.playback.play()
  assert.equal(view.state.playing, true)
  assert.equal(view.timers[0].delay, 2000)
  view.playback.pause()
  view.playback.configure({ autoplay: true })
  assert.equal(view.state.playing, false)
  assert.equal(view.timers.length, 1)
  view.playback.start(reviewedMove())
  assert.equal(view.state.playing, true)
  view.playback.dispose()
})

test('changing the playback delay replaces the active timer and stale callbacks cannot advance', () => {
  const view = harness()
  view.playback.start(reviewedMove())
  view.playback.configure({ delayMs: 2400 })
  assert.equal(view.timers[0].cancelled, true)
  assert.equal(view.timers[1].delay, 2400)
  view.timers[0].callback()
  assert.equal(view.state.currentStep, 0)
  view.timers[1].callback()
  assert.equal(view.state.currentStep, 1)
  assert.equal(view.timers[2].delay, 2400)
  view.playback.configure({ autoplay: false })
  assert.equal(view.timers[2].cancelled, true)
  assert.equal(view.state.playing, false)
  view.timers[2].callback()
  assert.equal(view.state.currentStep, 1)
  view.playback.configure({ autoplay: true })
  assert.equal(view.state.playing, false)
  view.playback.dispose()
})

test('delay configuration is bounded and leaves unchanged settings and reduced motion paused', () => {
  const view = harness(true, { delayMs: -100 })
  view.playback.start(reviewedMove())
  assert.equal(view.state.playing, false)
  view.playback.play()
  assert.equal(view.timers[0].delay, 500)
  view.playback.configure({ delayMs: 500 })
  assert.equal(view.timers.length, 1)
  assert.equal(view.timers[0].cancelled, false)
  view.playback.configure({ delayMs: 10000 })
  assert.equal(view.timers.at(-1)?.delay, 5000)
  view.playback.configure({ delayMs: NaN })
  assert.equal(view.timers.at(-1)?.delay, 1300)
  view.playback.stop()
  view.playback.configure({ autoplay: true, delayMs: 2000 })
  view.playback.start(reviewedMove())
  assert.equal(view.state.playing, false)
  view.playback.dispose()
})

test('Chess960 explanation demonstrates an actual castling alternative with physical king destination', () => {
  const parsed = parsePgn('[Variant "Chess960"]\n[FEN "4rkr1/4p1p1/8/8/8/8/8/5K1R w H - 0 1"]\n\n1. Ke1 *').moves[0]
  const move = reviewedMove({ ...parsed, bestMove: 'f1h1', bestMoveSan: 'O-O#', pv: ['f1h1'] })
  const steps = buildExplanationSteps(move)
  assert.equal(steps.at(-1)?.san, 'O-O#')
  assert.equal(steps.at(-1)?.uci, 'f1h1')
  assert.equal(steps.at(-1)?.kingTo, 'g1')
  assert.equal(steps.at(-1)?.fen, '4rkr1/4p1p1/8/8/8/8/8/5RK1 b - - 1 1')
})
