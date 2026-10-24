import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import test, { after } from 'node:test'
import { Chess } from 'chess.js'
import { analyzePosition, StockfishEngine } from './stockfish'
import { reviewGame } from '../lib/review'

const require = createRequire(import.meta.url)
const engineFile = join(dirname(require.resolve('stockfish/package.json')), 'bin/stockfish-19-lite-single.js')
const originalWorker = globalThis.Worker
const originalDocument = globalThis.document

class ProcessWorker extends EventTarget {
  private process = spawn(process.execPath, [engineFile])
  private buffer = ''

  constructor() {
    super()
    this.process.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''
      lines.forEach(line => this.dispatchEvent(new MessageEvent('message', { data: line })))
    })
    this.process.on('error', () => this.dispatchEvent(new Event('error')))
    this.process.stderr.resume()
  }

  postMessage(message: string) {
    if (this.process.stdin.writable) this.process.stdin.write(`${message}\n`)
  }

  terminate() {
    this.process.kill()
  }
}

globalThis.Worker = ProcessWorker as unknown as typeof Worker
globalThis.document = { baseURI: 'http://localhost/' } as Document
after(() => {
  globalThis.Worker = originalWorker
  globalThis.document = originalDocument
})

test('real bundled Stockfish finds a forced checkmate through the UCI wrapper', { timeout: 30000 }, async () => {
  const chess = new Chess()
  chess.loadPgn('1. f3 e5 2. g4 *')
  const analysis = await analyzePosition(chess.fen(), { depth: 10, timeMs: 200, multiPv: 2 })
  assert.equal(analysis.bestMove, 'd8h4')
  assert.equal(analysis.bestMoveSan, 'Qh4#')
  assert.equal(analysis.evaluation.mate, -1)
  assert.ok(analysis.lines.length >= 2)
  chess.move(analysis.bestMoveSan)
  assert.equal(chess.isCheckmate(), true)
})

test('real engine analysis reports game progress and exact checkmate at the end', { timeout: 30000 }, async () => {
  const progress: number[] = []
  const review = await reviewGame('1. f3 e5 2. g4 Qh4# 0-1', { depth: 8, timeMs: 60, onProgress: value => progress.push(value.percent) })
  assert.equal(review.moves.length, 4)
  assert.equal(review.moves[3].bestMoveSan, 'Qh4#')
  assert.deepEqual(review.moves[3].evaluation, { cp: -100000, mate: 0 })
  assert.equal(progress[0], 0)
  assert.equal(progress.at(-1), 100)
  assert.ok(review.moves.every(move => Number.isFinite(move.accuracy)))
})

test('aborting real analysis terminates its worker and rejects with AbortError', { timeout: 30000 }, async () => {
  const controller = new AbortController()
  const engine = new StockfishEngine(controller.signal)
  const analyzing = engine.analyze(new Chess().fen(), { depth: 24, timeMs: 10000 })
  controller.abort()
  await assert.rejects(analyzing, error => error instanceof Error && error.name === 'AbortError')
})

test('aborting during game review prevents stale positions from completing', { timeout: 30000 }, async () => {
  const controller = new AbortController()
  let completed = 0
  const analyzing = reviewGame('1. a3 a6 2. h3 h6 *', {
    signal: controller.signal, depth: 8, timeMs: 60,
    onProgress: value => { completed = value.completed; if (completed === 1) controller.abort() },
  })
  await assert.rejects(analyzing, error => error instanceof Error && error.name === 'AbortError')
  assert.equal(completed, 1)
})
