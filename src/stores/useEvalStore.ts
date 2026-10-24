import { DEFAULT_POSITION } from 'chess.js';
import { create } from 'zustand';

import openings from '../openings.tsv';
import classify from '../utils/classify';
import { useBoardStore } from './useBoardStore';
import { useStockfishOutputStore } from './useStockfishOutputStore';

import type { Classification } from '../utils/classify';
import type { MoveEval } from './useStockfishOutputStore';
import type { Chess, Move } from 'chess.js';

export type MoveEvalMerged = Omit<MoveEval, 'cp' | 'mate'> & { eval: string | number };
export type MoveEvalWithClass = MoveEvalMerged & { classification: Classification };

export function normalizeEval(moveEval: MoveEval, whiteToMove: boolean) {
  const sign = whiteToMove ? 1 : -1;
  if (typeof moveEval.cp === 'number')
    return moveEval.cp * sign;
  const mate = (moveEval.mate ?? 0) * sign;

  return `${mate > 0 ? '+' : '-'}M${Math.abs(mate)}`;
}

function classifyBest3Moves(best3Moves: MoveEval[][], history: Move[], fens: string[]) {
  const normalized = best3Moves.map((subArr, i) => subArr.map(moveEval => ({
    pv: moveEval.pv,
    line: moveEval.line,
    nodes: moveEval.nodes,
    multiPv: moveEval.multiPv,
    eval: normalizeEval(moveEval, fens[i].split(' ')[1] === 'w'),
  })));

  return normalized.map((subArr, i) => subArr.map((moveEval, _, arr) => ({
    ...moveEval,
    classification: classify({
      subArr: arr,
      lan: moveEval.pv,
      history,
      i,
      fen: fens[i],
      beforeEval: arr[0].eval,
      afterEval: moveEval.eval,
    }),
  })));
}

function classifyActualMoves(best3Moves: MoveEvalWithClass[][], cps: (string | number)[], history: Move[]) {
  return history.map((move, i) => {
    const alternatives = best3Moves[i] ?? [];
    const found = alternatives.find(moveEval => moveEval.pv === move.lan);
    if (found)
      return found.classification;

    return classify({ subArr: alternatives, lan: move.lan, history, i, beforeEval: cps[i] ?? 0, afterEval: cps[i + 1] ?? 0 });
  });
}

function getOpenings(fens: string[]) {
  const openingNames: string[] = [];

  for (let i = 0; i < fens.length; i++) {
    const found = openings.find(opening => opening.epd.split(' ').slice(0, 4).join(' ') === fens[i].split(' ').slice(0, 4).join(' '));
    openingNames.push(found?.name ?? openingNames.at(-1) ?? (fens[i] === DEFAULT_POSITION ? 'Starting Position' : 'Custom Position'));
  }

  return openingNames;
}

function getCps(best3Moves: MoveEvalWithClass[][], game: Chess) {
  const cps = best3Moves.map(subArr => subArr[0]?.eval ?? 0);
  if (game.isCheckmate())
    return [...cps, game.turn() === 'w' ? '0-1' : '1-0'];
  if (game.isStalemate())
    return [...cps, '1/2-1/2'];

  return cps;
}

export function formatCp(cp: string | number) {
  return typeof cp === 'string' ? cp : (cp / 100).toFixed(1);
}

function getAccuracy(cps: (string | number)[], whiteStarts: boolean): [number, number] {
  const chances = cps.map((cp) => {
    if (typeof cp === 'number')
      return 100 / (1 + Math.exp(-0.00368208 * cp));
    if (cp === '1/2-1/2')
      return 50;

    return cp.startsWith('-') || cp === '0-1' ? 0 : 100;
  });

  const totals = [0, 0];
  const counts = [0, 0];

  for (let i = 0; i < chances.length - 1; i++) {
    const white = i % 2 === 0 ? whiteStarts : !whiteStarts;
    const side = white ? 0 : 1;
    const loss = Math.max(0, (chances[i] - chances[i + 1]) * (white ? 1 : -1));
    totals[side] += loss ? 99.99 * Math.exp(-0.14 * loss) : 100;
    counts[side]++;
  }

  return totals.map((total, i) => counts[i] ? Number((total / counts[i]).toFixed(1)) : 100) as [number, number];
}

interface EvalStore {
  best3MovesWithClass: MoveEvalWithClass[][];
  classHistory: Classification[];
  openingNames: string[];
  cps: (string | number)[];
  accuracy: [number, number];
  populate: () => void;
  reset: () => void;
}

export const useEvalStore = create<EvalStore>(set => ({
  best3MovesWithClass: [],
  classHistory: [],
  openingNames: [],
  cps: [],
  accuracy: [0, 0],
  populate: () => set(() => {
    const best3Moves = useStockfishOutputStore.getState().best3Moves;
    const currentGame = useBoardStore.getState().currentGame;
    const history = currentGame.history({ verbose: true });
    const fens = [history[0]?.before ?? currentGame.header().FEN ?? DEFAULT_POSITION, ...history.map(move => move.after)];
    const best3MovesWithClass = classifyBest3Moves(best3Moves, history, fens);
    const openingNames = getOpenings(fens);
    const cps = getCps(best3MovesWithClass, currentGame);
    const classHistory = classifyActualMoves(best3MovesWithClass, cps, history);
    const accuracy = getAccuracy(cps, fens[0].split(' ')[1] === 'w');

    return { best3MovesWithClass, classHistory, openingNames, cps, accuracy };
  }),
  reset: () => set({ best3MovesWithClass: [], classHistory: [], openingNames: [], cps: [], accuracy: [0, 0] }),
}));
