import { boardWithHistory, completedLines, parseInfo, terminalEvaluation } from './protocol'
import type { AnalysisOptions, EngineLine, PositionAnalysis } from './types'

type Pending = { reject: (reason: Error) => void }

export class StockfishEngine {
  private worker: Worker
  private pending = new Set<Pending>()
  private disposed = false
  private ready: Promise<void>
  private signal?: AbortSignal
  private abort = () => this.dispose(new DOMException('Analysis cancelled', 'AbortError'))

  constructor(signal?: AbortSignal) {
    this.signal = signal
    this.worker = new Worker(new URL('engine/stockfish-19-lite-single.js', document.baseURI))
    this.worker.addEventListener('error', () => this.dispose(new Error('Stockfish could not load. Check that the engine files are available.')))
    this.worker.addEventListener('messageerror', () => this.dispose(new Error('Stockfish returned an unreadable response.')))
    signal?.addEventListener('abort', this.abort, { once: true })
    this.ready = this.initialize()
    if (signal?.aborted) this.abort()
  }

  private async initialize() {
    await this.waitFor(line => line === 'uciok', 'uci', 30000)
    this.worker.postMessage('setoption name Hash value 32')
    await this.waitFor(line => line === 'readyok', 'isready', 30000)
  }

  private waitFor(predicate: (line: string) => boolean, command: string, timeout: number): Promise<string> {
    if (this.disposed) return Promise.reject(new DOMException('Analysis cancelled', 'AbortError'))
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        this.worker.removeEventListener('message', listener)
        this.pending.delete(request)
      }
      const request = { reject: (reason: Error) => { cleanup(); reject(reason) } }
      const listener = (event: MessageEvent) => {
        for (const line of String(event.data).split('\n')) {
          if (predicate(line.trim())) {
            cleanup()
            resolve(line.trim())
            break
          }
        }
      }
      const timer = setTimeout(() => this.dispose(new Error('Stockfish timed out. Try a lower analysis depth.')), timeout)
      this.pending.add(request)
      this.worker.addEventListener('message', listener)
      this.worker.postMessage(command)
    })
  }

  async analyze(fen: string, options: AnalysisOptions = {}): Promise<PositionAnalysis> {
    await this.ready
    if (this.disposed) throw new DOMException('Analysis cancelled', 'AbortError')
    const board = boardWithHistory(fen, options.history)
    const terminal = terminalEvaluation(board)
    if (terminal) return { fen, evaluation: terminal, bestMove: null, bestMoveSan: null, pv: [], pvSan: [], depth: 0, lines: [] }
    const depth = Math.max(4, Math.min(24, Math.round(options.depth ?? 16)))
    const timeMs = Math.max(30, Math.min(10000, Math.round(options.timeMs ?? 500)))
    const multiPv = Math.max(1, Math.min(5, Math.round(options.multiPv ?? 1)))
    const lines = new Map<string, EngineLine>()
    this.worker.postMessage(`setoption name MultiPV value ${multiPv}`)
    this.worker.postMessage(options.history
      ? `position fen ${options.history.initialFen} moves ${options.history.moves.join(' ')}`
      : `position fen ${fen}`)
    const response = await this.waitFor(line => {
      const parsed = parseInfo(line, fen)
      if (parsed) lines.set(`${parsed.depth}:${parsed.rank}`, parsed)
      return line.startsWith('bestmove ')
    }, `go depth ${depth} movetime ${timeMs}`, Math.max(30000, timeMs * 4))
    const finished = completedLines([...lines.values()], Math.min(multiPv, board.moves().length))
    const primary = finished.find(line => line.rank === 1)
    const bestMove = primary?.pv[0]
    if (!primary || !bestMove || response.split(' ')[1] === '(none)') throw new Error('Stockfish did not return an exact scored legal move. Increase the analysis time and try again.')
    let bestMoveSan: string
    try {
      bestMoveSan = board.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove[4] }).san
    } catch {
      throw new Error('Stockfish returned an illegal move. Please restart analysis.')
    }
    return {
      fen,
      evaluation: primary.evaluation,
      bestMove,
      bestMoveSan,
      pv: primary.pv,
      pvSan: primary.pvSan,
      depth: primary.depth,
      lines: finished,
    }
  }

  dispose(reason: Error = new DOMException('Analysis cancelled', 'AbortError')) {
    if (this.disposed) return
    this.disposed = true
    this.signal?.removeEventListener('abort', this.abort)
    this.worker.postMessage('stop')
    this.worker.terminate()
    for (const request of [...this.pending]) request.reject(reason)
    this.pending.clear()
  }
}

export async function analyzePosition(fen: string, options: AnalysisOptions = {}): Promise<PositionAnalysis> {
  const engine = new StockfishEngine(options.signal)
  try {
    return await engine.analyze(fen, options)
  } finally {
    engine.dispose()
  }
}
