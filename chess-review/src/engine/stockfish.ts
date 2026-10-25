import { boardWithHistory, engineFen, parseInfo, terminalEvaluation } from './protocol'
import type { AnalysisOptions, EngineLine, PositionAnalysis } from './types'
import { resolveVariant, type ChessVariant } from '../lib/position'
import { fairyVariantName, usesVariantEngine } from '../lib/variants'
import { engineThreads, searchCommand } from './search-options'
import { searchResult } from './search-results'

type Pending = { reject: (reason: Error) => void }

export class StockfishEngine {
  private worker: Worker
  private pending = new Set<Pending>()
  private disposed = false
  private ready: Promise<void>
  private signal?: AbortSignal
  private searching = false
  private stopRequested = false
  private searchStarted = false
  readonly threads: number
  private abort = () => this.dispose(new DOMException('Analysis cancelled', 'AbortError'))
  private get variantEngine() { return usesVariantEngine(this.rules) }

  constructor(signal?: AbortSignal, private readonly rules: ChessVariant = 'chess', threads = 1) {
    this.signal = signal
    this.threads = engineThreads(threads)
    if ((this.variantEngine || this.threads > 1) && globalThis.crossOriginIsolated === false) throw new Error('This engine configuration needs WebAssembly threads and cross-origin isolation headers.')
    this.worker = new Worker(new URL(this.variantEngine ? 'engine/fairy/bridge.js' : this.threads > 1 ? 'engine/stockfish-19-lite.js' : 'engine/stockfish-19-lite-single.js', document.baseURI))
    this.worker.addEventListener('error', () => this.dispose(new Error('Stockfish could not load. Check that the engine files are available.')))
    this.worker.addEventListener('messageerror', () => this.dispose(new Error('Stockfish returned an unreadable response.')))
    signal?.addEventListener('abort', this.abort, { once: true })
    this.ready = this.initialize()
    if (signal?.aborted) this.abort()
  }

  private async initialize() {
    await this.waitFor(line => line === 'uciok', 'uci', 30000)
    if (this.variantEngine) {
      this.worker.postMessage(`setoption name UCI_Variant value ${fairyVariantName(this.rules)}`)
      this.worker.postMessage('setoption name Use NNUE value false')
    }
    if (this.variantEngine || this.threads > 1) this.worker.postMessage(`setoption name Threads value ${this.threads}`)
    this.worker.postMessage('setoption name Hash value 32')
    await this.waitFor(line => line === 'readyok', 'isready', 30000)
  }

  private waitFor(predicate: (line: string) => boolean, command: string, timeout: number | null): Promise<string> {
    if (this.disposed) return Promise.reject(new DOMException('Analysis cancelled', 'AbortError'))
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        this.worker.removeEventListener('message', listener)
        this.pending.delete(request)
      }
      const request = { reject: (reason: Error) => { cleanup(); reject(reason) } }
      const listener = (event: MessageEvent) => {
        if (this.disposed) return
        for (const line of String(event.data).split('\n')) {
          if (line.startsWith('engineerror ')) { this.dispose(new Error(line.slice(12))); return }
          let matched: boolean
          try { matched = predicate(line.trim()) }
          catch (error) { this.dispose(error instanceof Error ? error : new Error('Engine response processing failed.')); return }
          if (matched) {
            cleanup()
            resolve(line.trim())
            break
          }
        }
      }
      const timer = timeout === null ? undefined : setTimeout(() => this.dispose(new Error('Stockfish timed out. Try a lower analysis depth.')), timeout)
      this.pending.add(request)
      this.worker.addEventListener('message', listener)
      this.worker.postMessage(command)
    })
  }

  async analyze(fen: string, options: AnalysisOptions = {}): Promise<PositionAnalysis> {
    if (this.searching) throw new Error('This engine is already analyzing a position.')
    this.searching = true
    this.stopRequested = false
    this.searchStarted = false
    try { return await this.search(fen, options) }
    finally { this.searching = false }
  }

  private async search(fen: string, options: AnalysisOptions): Promise<PositionAnalysis> {
    await this.ready
    if (this.disposed || this.stopRequested) throw new DOMException('Analysis cancelled', 'AbortError')
    const variant = resolveVariant(fen, options.variant)
    if (variant !== this.rules) throw new Error('The selected engine does not match this game variant.')
    const board = boardWithHistory(fen, options.history, variant)
    const terminal = terminalEvaluation(board)
    if (terminal) return { fen, variant, evaluation: terminal, bestMove: null, bestMoveSan: null, pv: [], pvSan: [], depth: 0, lines: [] }
    const multiPv = Number.isFinite(options.multiPv) ? Math.max(1, Math.min(5, Math.round(options.multiPv!))) : 1
    const lines = new Map<string, EngineLine>()
    const candidates = Math.min(multiPv, board.moves().length)
    const search = searchCommand(options)
    let lastUpdate = 0
    if (!this.variantEngine) this.worker.postMessage(`setoption name UCI_Chess960 value ${variant === 'chess960' ? 'true' : 'false'}`)
    this.worker.postMessage(`setoption name MultiPV value ${multiPv}`)
    this.worker.postMessage(options.history
      ? `position fen ${engineFen(options.history.initialFen, variant)} moves ${options.history.moves.join(' ')}`
      : `position fen ${engineFen(fen, variant)}`)
    this.searchStarted = true
    const response = await this.waitFor(line => {
      const parsed = parseInfo(line, fen, variant)
      if (parsed) {
        lines.set(`${parsed.depth}:${parsed.rank}`, parsed)
        if (options.onUpdate && Date.now() - lastUpdate >= 100) {
          const update = searchResult(fen, variant, [...lines.values()], candidates)
          if (update) { lastUpdate = Date.now(); options.onUpdate(update) }
        }
      }
      return line.startsWith('bestmove ')
    }, search.command, search.timeout)
    const result = searchResult(fen, variant, [...lines.values()], candidates)
    if (!result || response.split(' ')[1] === '(none)') throw new Error('Stockfish did not return an exact scored legal move. Increase the analysis time and try again.')
    options.onUpdate?.(result)
    return result
  }

  stop() {
    this.stopRequested = true
    if (!this.disposed && this.searching) {
      if (this.searchStarted) this.worker.postMessage('stop')
      else this.dispose(new DOMException('Analysis cancelled', 'AbortError'))
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
  if (options.signal?.aborted) throw new DOMException('Analysis cancelled', 'AbortError')
  const variant = resolveVariant(fen, options.variant)
  const terminal = terminalEvaluation(boardWithHistory(fen, options.history, variant))
  if (terminal) return { fen, variant, evaluation: terminal, bestMove: null, bestMoveSan: null, pv: [], pvSan: [], depth: 0, lines: [] }
  const engine = new StockfishEngine(options.signal, variant, options.threads)
  try {
    return await engine.analyze(fen, options)
  } finally {
    engine.dispose()
  }
}
