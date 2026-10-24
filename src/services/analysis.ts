import { Chess } from 'chess.js';

import { useSettingsStore } from '../stores/useSettingsStore';
import { parseEngineInfo } from './engineOutput';

import type { AnalysisModel } from '../stores/useSettingsStore';
import type { MoveEval } from '../stores/useStockfishOutputStore';

export interface StockfishEngine {
  postMessage: (command: string) => void;
  addMessageListener: (listener: (message: string) => void) => void;
  removeMessageListener: (listener: (message: string) => void) => void;
  terminate: () => void;
}
export interface AnalysisOptions {
  depth?: number;
  model?: AnalysisModel;
  multiPv?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

declare global {
  interface Window {
    Stockfish?: () => Promise<StockfishEngine>;
  }
}

export async function loadStockfish() {
  if (!window.Stockfish)
    throw new Error('Stockfish is unavailable. Reload the page and try again.');

  return window.Stockfish();
}

export async function createAnalysisEngine(options: AnalysisOptions = {}) {
  const settings = useSettingsStore.getState().settings;
  const depth = Math.max(8, Math.min(24, options.depth ?? settings.analysisDepth));
  const model = options.model ?? settings.analysisModel;
  const signal = options.signal;
  if (signal?.aborted)
    throw new DOMException('Analysis cancelled', 'AbortError');

  let worker: StockfishEngine | undefined;
  let rejectPending: ((error: Error) => void) | undefined;
  let disposed = false;

  function dispose() {
    if (disposed)
      return;
    disposed = true;
    rejectPending?.(new DOMException('Analysis cancelled', 'AbortError'));
    worker?.terminate();
    signal?.removeEventListener('abort', dispose);
  }

  signal?.addEventListener('abort', dispose, { once: true });

  try {
    worker = await loadStockfish();

    if (disposed) {
      worker.terminate();
      throw new DOMException('Analysis cancelled', 'AbortError');
    }

    const engine = worker;

    function waitFor(command: string, expected: string) {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('Stockfish did not become ready. Please try again.')), 20000);

        function finish(error?: Error) {
          clearTimeout(timer);
          engine.removeMessageListener(listener);
          rejectPending = undefined;
          if (error)
            reject(error);
          else
            resolve();
        }

        function listener(message: string) {
          if (message.trim() === expected)
            finish();
        }

        rejectPending = finish;
        engine.addMessageListener(listener);
        engine.postMessage(command);
      });
    }

    await waitFor('uci', 'uciok');
    engine.postMessage(`setoption name Use NNUE value ${model === 'nnue' ? 'true' : 'false'}`);
    engine.postMessage(`setoption name MultiPV value ${Math.max(2, Math.min(10, options.multiPv ?? 3))}`);
    await waitFor('isready', 'readyok');

    async function analyze(fen: string): Promise<MoveEval[]> {
      if (disposed)
        throw new DOMException('Analysis cancelled', 'AbortError');
      if (rejectPending)
        throw new Error('This engine is already analyzing a position.');
      const chess = new Chess(fen);
      if (chess.isCheckmate() || chess.isStalemate())
        return [];

      return new Promise<MoveEval[]>((resolve, reject) => {
        const moves = new Map<number, { depth: number; move: MoveEval }>();

        const timer = setTimeout(() => {
          finish(new Error('Analysis timed out. Try a lower depth.'));
          dispose();
        }, options.timeoutMs ?? 120000);

        function finish(error?: Error) {
          clearTimeout(timer);
          engine.removeMessageListener(listener);
          rejectPending = undefined;

          if (error) {
            reject(error);
          }
          else {
            const result = [...moves.values()].sort((a, b) => a.move.multiPv - b.move.multiPv).map(item => item.move);
            if (result.length)
              resolve(result);
            else
              reject(new Error('Stockfish returned no evaluation for this position.'));
          }
        }

        function listener(message: string) {
          const info = parseEngineInfo(message);
          if (info && info.depth >= (moves.get(info.move.multiPv)?.depth ?? 0))
            moves.set(info.move.multiPv, info);
          if (message.startsWith('bestmove '))
            finish();
        }

        rejectPending = finish;
        engine.addMessageListener(listener);
        engine.postMessage(`position fen ${fen}`);
        engine.postMessage(`go depth ${depth}`);
      });
    }

    return { analyze, dispose };
  }
  catch (error) {
    dispose();
    throw error;
  }
}

export async function analyzePosition(fen: string, options: AnalysisOptions = {}) {
  const engine = await createAnalysisEngine(options);

  try {
    return await engine.analyze(fen);
  }
  finally {
    engine.dispose();
  }
}
