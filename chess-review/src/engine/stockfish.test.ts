import assert from 'node:assert/strict'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { after } from 'node:test'
import { Chess } from 'chess.js'
import { analyzePosition, StockfishEngine } from './stockfish'
import { reviewGame } from '../lib/review'
import { createPosition } from '../lib/position'

const require = createRequire(import.meta.url)
const engineFile = join(dirname(require.resolve('stockfish/package.json')), 'bin/stockfish-19-lite-single.js')
const threadedEngineFile = join(dirname(require.resolve('stockfish/package.json')), 'bin/stockfish-19-lite.js')
const originalWorker = globalThis.Worker
const originalDocument = globalThis.document

class ProcessWorker extends EventTarget {
  static output: { file: string; line: string }[] = []
  private process: ChildProcessWithoutNullStreams
  private buffer = ''

  constructor(url?: URL | string) {
    super()
    const file = String(url).includes('/engine/fairy/bridge.js') ? fileURLToPath(new URL('../../scripts/fairy-uci.cjs', import.meta.url)) : String(url).endsWith('/engine/stockfish-19-lite.js') ? threadedEngineFile : engineFile
    this.process = spawn(process.execPath, file === threadedEngineFile ? ['--require', fileURLToPath(new URL('../test/thread-probe.cjs', import.meta.url)), file] : [file])
    this.process.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''
      lines.forEach(line => { ProcessWorker.output.push({ file, line }); this.dispatchEvent(new MessageEvent('message', { data: line })) })
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

test('real threaded Lite build creates the requested search threads and returns legal scored lines', { timeout: 30000 }, async () => {
  for (const threads of [2, 3]) {
    const start = ProcessWorker.output.length
    const analysis = await analyzePosition(new Chess().fen(), { threads, limit: 'time', timeMs: 250, multiPv: 2 })
    assert.equal(analysis.lines.length, 2)
    assert.doesNotThrow(() => new Chess().move(analysis.bestMoveSan!))
    const output = ProcessWorker.output.slice(start).filter(item => item.file === threadedEngineFile).map(item => item.line).join('\n')
    assert.ok(output.includes('Stockfish 19 Lite WASM Multithreaded'))
    assert.equal((output.match(/open-file-probe worker-created/g) ?? []).length, threads + 1)
  }
})

test('continuous search publishes legal updates and manual stop retains a complete scored result', { timeout: 30000 }, async () => {
  const engine = new StockfishEngine()
  const updates: number[] = []
  try {
    const result = await engine.analyze(new Chess().fen(), { limit: 'continuous', multiPv: 3, onUpdate: update => {
      updates.push(update.depth)
      for (const line of update.lines) {
        const board = new Chess()
        for (const san of line.pvSan) board.move(san)
        assert.equal(line.pv.length, line.pvSan.length)
      }
      if (update.depth >= 10 && updates.length >= 2) engine.stop()
    } })
    assert.ok(updates.length >= 2)
    assert.ok(result.depth >= 10)
    assert.equal(result.lines.length, 3)
    assert.equal(new Set(result.lines.map(line => line.depth)).size, 1)
    assert.doesNotThrow(() => new Chess().move(result.bestMoveSan!))
  } finally { engine.dispose() }
})

test('stopping during initialization rejects promptly and continuous cancellation stops updates', { timeout: 30000 }, async () => {
  const early = new StockfishEngine()
  const pending = early.analyze(new Chess().fen(), { limit: 'continuous' })
  early.stop()
  await assert.rejects(pending, error => error instanceof Error && error.name === 'AbortError')
  const controller = new AbortController()
  let updates = 0
  await assert.rejects(analyzePosition(new Chess().fen(), { limit: 'continuous', signal: controller.signal, onUpdate: () => { updates++; controller.abort() } }), error => error instanceof Error && error.name === 'AbortError')
  assert.equal(updates, 1)
})

test('real Stockfish Chess960 mode returns canonical king-to-rook castling UCI and legal mating SAN', { timeout: 30000 }, async () => {
  const fen = '4rkr1/4p1p1/8/8/8/8/8/5K1R w H - 0 1'
  for (const threads of [1, 2]) {
    const analysis = await analyzePosition(fen, { variant: 'chess960', depth: 10, timeMs: 200, multiPv: 2, threads })
    assert.equal(analysis.variant, 'chess960')
    assert.equal(analysis.bestMove, 'f1h1')
    assert.equal(analysis.bestMoveSan, 'O-O#')
    assert.equal(analysis.evaluation.mate, 1)
    const board = createPosition(fen, 'chess960')
    board.move({ from: analysis.bestMove!.slice(0, 2), to: analysis.bestMove!.slice(2, 4) })
    assert.equal(board.get('g1')?.type, 'k')
    assert.equal(board.get('f1')?.type, 'r')
    assert.equal(board.isCheckmate(), true)
  }
})

test('real engine replays a public Chess960 game history containing both colors castling', { timeout: 30000 }, async () => {
  const initialFen = 'brqbknrn/pppppppp/8/8/8/8/PPPPPPPP/BRQBKNRN w GBgb - 0 1'
  const board = createPosition(initialFen, 'chess960')
  const sans = ['d4', 'Nhg6', 'e4', 'c5', 'd5', 'b5', 'Ne3', 'c4', 'O-O', 'd6', 'b4', 'Nd7', 'Ng3', 'e6', 'Nh5', 'Bf6', 'Nxf6+', 'gxf6', 'f4', 'Qc7', 'Bg4', 'e5', 'Bxd7+', 'Qxd7', 'Nf5', 'Ne7', 'Nh6', 'Rg6', 'fxe5', 'dxe5', 'Qe3', 'O-O-O']
  const moves = sans.map(san => { const move = board.move(san); return move.uci! })
  const analysis = await analyzePosition(board.fen(), { variant: 'chess960', depth: 8, timeMs: 100, history: { initialFen, moves } })
  assert.equal(analysis.variant, 'chess960')
  assert.ok(analysis.bestMove)
  assert.doesNotThrow(() => board.move({ from: analysis.bestMove!.slice(0, 2), to: analysis.bestMove!.slice(2, 4), promotion: analysis.bestMove![4] }))
  assert.ok(analysis.pvSan.length > 0)
})

test('complete Chess960 review records exact mating castle, variant and physical destinations', { timeout: 30000 }, async () => {
  const pgn = '[Variant "Chess960"]\n[FEN "4rkr1/4p1p1/8/8/8/8/8/5K1R w H - 0 1"]\n[Result "1-0"]\n\n1. O-O# 1-0'
  const review = await reviewGame(pgn, { depth: 8, timeMs: 100 })
  assert.equal(review.variant, 'chess960')
  assert.equal(review.moves[0].variant, 'chess960')
  assert.equal(review.moves[0].uci, 'f1h1')
  assert.equal(review.moves[0].kingTo, 'g1')
  assert.equal(review.moves[0].rookTo, 'f1')
  assert.equal(review.moves[0].bestMoveSan, 'O-O#')
  assert.equal(review.moves[0].classification, 'best')
  assert.deepEqual(review.moves[0].evaluation, { cp: 100000, mate: 0 })
  assert.equal(review.opening, null)
})

test('real variant engine finds a third-check win that is not standard checkmate', { timeout: 30000 }, async () => {
  const { readFileSync } = await import('node:fs')
  const { parsePgn } = await import('../lib/game')
  const game = parsePgn(readFileSync(new URL('../test/fixtures/three-check-78864833399.pgn', import.meta.url), 'utf8'))
  const fen = game.positions[51]
  for (const threads of [1, 2]) {
    const result = await analyzePosition(fen, { variant: 'threecheck', depth: 10, timeMs: 150, threads })
    assert.match(result.bestMoveSan!, /#$/)
    assert.equal(result.evaluation.mate, -1)
    const board = createPosition(fen, 'threecheck')
    board.move(result.bestMove!)
    assert.deepEqual(board.variantOutcome?.(), { winner: 'b', reason: 'third-check' })
    assert.equal(board.isCheckmate(), false)
  }
})

test('Fairy-Stockfish reviews and exports a King of the Hill center-square win', { timeout: 30000 }, async () => {
  const { parsePgn } = await import('../lib/game')
  const { reviewedPgn } = await import('../lib/report')
  const { parseReviewTransfer, serializeReviewTransfer } = await import('../lib/review-transfer')
  const pgn = `[Event "King of the Hill"]
[Variant "King of the Hill"]
[SetUp "1"]
[FEN "7k/8/8/8/8/2K5/8/8 w - - 0 1"]
[Result "1-0"]

1. Kd4 1-0`
  const original = parsePgn(pgn)
  const review = await reviewGame(pgn, { depth: 8, timeMs: 60 })
  assert.equal(review.variant, 'kingofthehill')
  assert.match(review.engine, /Fairy-Stockfish wasm 1\.1\.12.*King of the Hill/)
  assert.match(review.accuracyModel, /uncalibrated move-quality heuristic/)
  assert.equal(review.opening, null)
  assert.deepEqual(review.moves.at(-1)!.evaluation, { cp: 100000, mate: 0 })
  const exported = parsePgn(reviewedPgn(review))
  assert.equal(exported.headers.Variant, 'King of the Hill')
  assert.deepEqual(exported.positions, original.positions)
  assert.deepEqual(exported.clocks, original.clocks)
  assert.equal(exported.result, '1-0')
  const imported = parseReviewTransfer(serializeReviewTransfer(review))
  assert.equal(imported.variant, 'kingofthehill')
  assert.deepEqual(imported.moves, JSON.parse(JSON.stringify(review.moves)))
})

test('Fairy-Stockfish reviews and exports an Atomic king explosion', { timeout: 30000 }, async () => {
  const { readFileSync } = await import('node:fs')
  const { parsePgn } = await import('../lib/game')
  const { reviewedPgn } = await import('../lib/report')
  const { parseReviewTransfer, serializeReviewTransfer } = await import('../lib/review-transfer')
  const pgn = readFileSync(new URL('../test/fixtures/atomic-king-explosion.pgn', import.meta.url), 'utf8')
  const original = parsePgn(pgn)
  const review = await reviewGame(pgn, { depth: 8, timeMs: 60 })
  assert.equal(review.variant, 'atomic')
  assert.match(review.engine, /Fairy-Stockfish wasm 1\.1\.12.*Atomic/)
  assert.match(review.accuracyModel, /uncalibrated move-quality heuristic/)
  assert.equal(review.opening, null)
  assert.deepEqual(review.moves.at(-1)!.evaluation, { cp: 100000, mate: 0 })
  const exported = parsePgn(reviewedPgn(review))
  assert.equal(exported.headers.Variant, 'Atomic')
  assert.deepEqual(exported.positions, original.positions)
  assert.equal(exported.result, '1-0')
  const imported = parseReviewTransfer(serializeReviewTransfer(review))
  assert.equal(imported.variant, 'atomic')
  assert.deepEqual(imported.moves, JSON.parse(JSON.stringify(review.moves)))
})

test('Fairy-Stockfish reviews and exports a Horde army-elimination win', { timeout: 30000 }, async () => {
  const { readFileSync } = await import('node:fs')
  const { parsePgn } = await import('../lib/game')
  const { reviewedPgn } = await import('../lib/report')
  const { parseReviewTransfer, serializeReviewTransfer } = await import('../lib/review-transfer')
  const pgn = readFileSync(new URL('../test/fixtures/horde-army-eliminated.pgn', import.meta.url), 'utf8')
  const original = parsePgn(pgn)
  const review = await reviewGame(pgn, { depth: 8, timeMs: 60 })
  assert.equal(review.variant, 'horde')
  assert.match(review.engine, /Fairy-Stockfish wasm 1\.1\.12.*Horde/)
  assert.match(review.accuracyModel, /uncalibrated move-quality heuristic/)
  assert.equal(review.opening, null)
  assert.deepEqual(review.moves.at(-1)!.evaluation, { cp: -100000, mate: 0 })
  const exported = parsePgn(reviewedPgn(review))
  assert.equal(exported.headers.Variant, 'Horde')
  assert.deepEqual(exported.positions, original.positions)
  assert.equal(exported.result, '0-1')
  const imported = parseReviewTransfer(serializeReviewTransfer(review))
  assert.equal(imported.variant, 'horde')
  assert.deepEqual(imported.moves, JSON.parse(JSON.stringify(review.moves)))
})

test('both actual three-check games review and export every counter, position, clock and result', { timeout: 90000 }, async () => {
  const { readFileSync } = await import('node:fs')
  const { parsePgn } = await import('../lib/game')
  const { reviewedPgn } = await import('../lib/report')
  const { parseReviewTransfer, serializeReviewTransfer } = await import('../lib/review-transfer')
  for (const id of ['78864833399', '61860050863']) {
    const pgn = readFileSync(new URL(`../test/fixtures/three-check-${id}.pgn`, import.meta.url), 'utf8')
    const original = parsePgn(pgn)
    const review = await reviewGame(pgn, { depth: 8, timeMs: 60 })
    assert.equal(review.variant, 'threecheck')
    assert.match(review.engine, /Fairy-Stockfish wasm 1\.1\.12/)
    assert.match(review.accuracyModel, /uncalibrated move-quality heuristic/)
    assert.equal(review.opening, null)
    const exported = parsePgn(reviewedPgn(review))
    assert.deepEqual(exported.positions, original.positions)
    assert.deepEqual(exported.clocks, original.clocks)
    assert.equal(exported.result, original.result)
    const transferred = parseReviewTransfer(serializeReviewTransfer(review))
    assert.deepEqual(transferred.moves, JSON.parse(JSON.stringify(review.moves)))
    if (id === '78864833399') {
      assert.match(review.moves.at(-1)!.explanation, /third check/)
      assert.doesNotMatch(review.moves.at(-1)!.explanation, /Checkmate ends/)
    }
  }
})
