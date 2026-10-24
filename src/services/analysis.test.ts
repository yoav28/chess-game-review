import { Chess, DEFAULT_POSITION } from 'chess.js';
import { afterEach, expect, test, vi } from 'vitest';

import { analyzePosition, createAnalysisEngine } from './analysis';
import { parseEngineInfo } from './engineOutput';

import type { StockfishEngine } from './analysis';

function fakeStockfish(search = true) {
  const listeners = new Set<(message: string) => void>();
  const emit = (message: string) => listeners.forEach(listener => listener(message));

  const worker: StockfishEngine = {
    postMessage: vi.fn((command: string) => {
      queueMicrotask(() => {
        if (command === 'uci')
          emit('uciok');
        if (command === 'isready')
          emit('readyok');

        if (command.startsWith('go') && search) {
          emit('info depth 8 multipv 1 score cp 30 nodes 100 pv e2e4 e7e5');
          emit('info depth 10 multipv 1 score cp 45 nodes 200 pv e2e4 c7c5');
          emit('info depth 8 multipv 1 score cp 90 nodes 100 pv d2d4 d7d5');
          emit('info depth 10 multipv 2 score cp 25 nodes 200 pv d2d4 d7d5');
          emit('bestmove e2e4 ponder c7c5');
        }
      });
    }),
    addMessageListener: listener => listeners.add(listener),
    removeMessageListener: listener => listeners.delete(listener),
    terminate: vi.fn(),
  };

  window.Stockfish = vi.fn(async () => worker);

  return worker;
}

afterEach(() => {
  delete window.Stockfish;
});

test('parses multi-digit MultiPV, mate scores and full principal variation', () => {
  expect(parseEngineInfo('info depth 12 multipv 10 score mate -3 nodes 1200 pv e7e8q a8a7')).toEqual({
    depth: 12,
    move: { multiPv: 10, mate: -3, nodes: 1200, pv: 'e7e8q', line: ['e7e8q', 'a8a7'] },
  });

  expect(parseEngineInfo('info depth 12 score cp 80 lowerbound nodes 2 pv e2e4')).toBeUndefined();
  expect(parseEngineInfo('info depth 12 currmove e2e4')).toBeUndefined();
});

test('uses requested settings, keeps final deepest variations and disposes the engine', async () => {
  const worker = fakeStockfish();
  const result = await analyzePosition(DEFAULT_POSITION, { depth: 14, model: 'classical' });
  expect(worker.postMessage).toHaveBeenCalledWith('setoption name Use NNUE value false');
  expect(worker.postMessage).toHaveBeenCalledWith('go depth 14');
  expect(result.map(move => [move.pv, move.cp])).toEqual([['e2e4', 45], ['d2d4', 25]]);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

test('cancellation rejects an active search and terminates it', async () => {
  const worker = fakeStockfish(false);
  const controller = new AbortController();
  const engine = await createAnalysisEngine({ signal: controller.signal });
  const result = engine.analyze(DEFAULT_POSITION);
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  expect(worker.terminate).toHaveBeenCalledOnce();
});

test('returns no lines for terminal positions', async () => {
  const worker = fakeStockfish();
  const game = new Chess();
  ['f3', 'e5', 'g4', 'Qh4#'].forEach(move => game.move(move));
  expect(await analyzePosition(game.fen())).toEqual([]);
  expect(worker.postMessage).not.toHaveBeenCalledWith(expect.stringMatching(/^go /));
});
