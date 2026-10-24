import { waitFor } from '@testing-library/react';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { beforeEach, expect, test, vi } from 'vitest';

import { analyzePosition } from '../services/analysis';
import { useVariationStore } from './useVariationStore';

import type { MoveEval } from './useStockfishOutputStore';

vi.mock('../services/analysis', () => ({ analyzePosition: vi.fn() }));

const analyze = vi.mocked(analyzePosition);
const evaluation = (pv: string, cp: number, line = [pv]): MoveEval => ({ pv, cp, line, nodes: 100, multiPv: 1 });

beforeEach(() => {
  useVariationStore.getState().reset();
  analyze.mockReset();
});

test('rejects illegal alternatives without changing the board or starting analysis', () => {
  useVariationStore.getState().play(DEFAULT_POSITION, 'e2', 'e5');
  expect(useVariationStore.getState().fen).toBeNull();
  expect(analyze).not.toHaveBeenCalled();
});

test('evaluates a legal variation and its continuation without modifying the original game', async () => {
  const original = new Chess();
  analyze.mockResolvedValueOnce([evaluation('e2e4', 25)]).mockResolvedValueOnce([evaluation('e7e5', -20, ['e7e5', 'g1f3'])]);
  useVariationStore.getState().play(original.fen(), 'e2', 'e4');
  await waitFor(() => expect(useVariationStore.getState().status).toBe('ready'));
  expect(original.fen()).toBe(DEFAULT_POSITION);
  expect(useVariationStore.getState().moves.map(move => move.san)).toEqual(['e4']);
  expect(useVariationStore.getState().feedback).toMatchObject({ label: 'Best move', whiteEvaluation: 20, continuation: ['e5', 'Nf3'] });
});

test('normalizes black alternatives to White evaluation and identifies a lost advantage', async () => {
  const game = new Chess();
  game.move('e4');
  analyze.mockResolvedValueOnce([evaluation('e7e5', 200)]).mockResolvedValueOnce([evaluation('d2d4', 200)]);
  useVariationStore.getState().play(game.fen(), 'f7', 'f6');
  await waitFor(() => expect(useVariationStore.getState().status).toBe('ready'));
  expect(useVariationStore.getState().feedback).toMatchObject({ label: 'Blunder', whiteEvaluation: 200, bestMove: 'e5' });
});

test('resets a variation and ignores its late engine result', async () => {
  let resolveAnalysis: (moves: MoveEval[]) => void = () => {};
  analyze.mockImplementationOnce(() => new Promise(resolve => resolveAnalysis = resolve));
  useVariationStore.getState().play(DEFAULT_POSITION, 'e2', 'e4');
  const signal = analyze.mock.calls[0][1]?.signal;
  useVariationStore.getState().reset();
  resolveAnalysis([evaluation('e2e4', 10)]);
  await Promise.resolve();
  expect(signal?.aborted).toBe(true);
  expect(analyze).toHaveBeenCalledTimes(1);
  expect(useVariationStore.getState()).toMatchObject({ fen: null, status: 'idle', feedback: null, moves: [] });
});

test('supports underpromotion and reports the resulting draw', async () => {
  analyze.mockResolvedValueOnce([evaluation('b7b8q', 900)]);
  useVariationStore.getState().play('7k/1P6/8/8/8/8/8/K7 w - - 0 1', 'b7', 'b8', 'n');
  await waitFor(() => expect(useVariationStore.getState().status).toBe('ready'));
  expect(new Chess(useVariationStore.getState().fen!).get('b8')?.type).toBe('n');
  expect(useVariationStore.getState().feedback?.evaluation).toBe('Draw');
  expect(analyze).toHaveBeenCalledTimes(1);
});
