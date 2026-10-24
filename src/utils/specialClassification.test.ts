import { Chess } from 'chess.js';
import { expect, test } from 'vitest';

import { useBoardStore } from '../stores/useBoardStore';
import { normalizeEval, useEvalStore } from '../stores/useEvalStore';
import { useStockfishOutputStore } from '../stores/useStockfishOutputStore';
import classify from './classify';
import { isPieceSacrifice, specialClassification } from './specialClassification';

import type { MoveEvalMerged } from '../stores/useEvalStore';

function line(pv: string, value: number, multiPv: number): MoveEvalMerged {
  return { pv, eval: value, multiPv, nodes: 100 };
}

test('great requires the best move and a bad second-best alternative', () => {
  const chess = new Chess();
  const alternatives = [line('e2e4', 30, 1), line('d2d4', -180, 2)];
  expect(specialClassification(chess.fen(), 'e2e4', alternatives, 30)).toBe('great');
  expect(specialClassification(chess.fen(), 'd2d4', alternatives, -180)).toBeUndefined();
  expect(specialClassification(chess.fen(), 'e2e4', [alternatives[0], line('d2d4', 10, 2)], 30)).toBeUndefined();
});

test('detects a sound piece sacrifice and rejects an ordinary equal exchange', () => {
  const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  expect(isPieceSacrifice(fen, 'c4f7')).toBe(true);
  expect(specialClassification(fen, 'c4f7', [line('c4f7', 40, 1), line('d2d3', 20, 2)], 40)).toBe('brilliant');
  expect(specialClassification(fen, 'c4f7', [line('c4f7', -200, 1), line('d2d3', -220, 2)], -200)).toBeUndefined();
  expect(specialClassification(fen, 'c4f7', [line('c4f7', 700, 1), line('d2d3', 500, 2)], 700)).toBe('great');
  expect(isPieceSacrifice('4k3/8/8/8/4p3/3r4/2B5/4K3 w - - 0 1', 'c2d3')).toBe(false);
});

test('normalizes evaluations for black to move and handles a black-first PGN', () => {
  expect(normalizeEval({ pv: 'e7e5', nodes: 10, multiPv: 1, cp: 120 }, false)).toBe(-120);
  expect(normalizeEval({ pv: 'e7e5', nodes: 10, multiPv: 1, mate: 2 }, false)).toBe('-M2');
  useBoardStore.getState().loadGame('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K3 b - - 0 1"]\n\n1... Kd7 *');
  useStockfishOutputStore.setState({ best3Moves: [[{ pv: 'e8d7', nodes: 1, multiPv: 1, cp: 0 }], [{ pv: 'e1d2', nodes: 1, multiPv: 1, cp: 0 }]] });
  useEvalStore.getState().populate();
  expect(useEvalStore.getState().cps).toEqual([-0, 0]);
  expect(useEvalStore.getState().accuracy).toEqual([100, 100]);
});

test('a single returned line is not forced when multiple legal moves exist', () => {
  const chess = new Chess();
  chess.move('e4');
  expect(classify({ subArr: [line('e2e4', 20, 1)], lan: 'e2e4', history: chess.history({ verbose: true }), i: 0, beforeEval: 20, afterEval: 20 })).toBe('book');
});

test('classifies alternatives from a custom FEN with no move history', () => {
  useBoardStore.getState().loadGame('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K3 b - - 0 1"]\n\n*');
  useStockfishOutputStore.setState({ best3Moves: [[{ pv: 'e8d7', nodes: 1, multiPv: 1, cp: 0 }]] });
  expect(() => useEvalStore.getState().populate()).not.toThrow();
  expect(useEvalStore.getState().classHistory).toEqual([]);
});

test('great does not reward a best move when the alternatives also remain completely winning', () => {
  const chess = new Chess();
  chess.move('e4');
  const alternatives = [line('e2e4', 1200, 1), line('d2d4', 1000, 2)];
  expect(classify({ subArr: alternatives, lan: 'e2e4', history: chess.history({ verbose: true }), i: 0, beforeEval: 1200, afterEval: 1200 })).toBe('book');
});
