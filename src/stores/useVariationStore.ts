import { Chess } from 'chess.js';
import { create } from 'zustand';

import { analyzePosition } from '../services/analysis';

import type { MoveEval } from './useStockfishOutputStore';
import type { Move, PieceSymbol, Square } from 'chess.js';

interface VariationFeedback {
  label: string;
  evaluation: string;
  bestMove: string;
  continuation: string[];
  whiteEvaluation: string | number;
}

interface VariationStore {
  fen: string | null;
  moves: Move[];
  status: 'idle' | 'analyzing' | 'ready' | 'error';
  feedback: VariationFeedback | null;
  error: string | null;
  play: (sourceFen: string, from: Square, to: Square, promotion?: PieceSymbol) => void;
  reset: () => void;
}

let activeAnalysis: AbortController | null = null;

function score(move: MoveEval) {
  return move.cp ?? Math.sign(move.mate ?? 0) * (100000 - Math.abs(move.mate ?? 0));
}

function evaluationLabel(game: Chess, move?: MoveEval) {
  if (game.isCheckmate())
    return game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
  if (game.isDraw())
    return 'Draw';
  if (!move)
    return '';
  const sign = game.turn() === 'w' ? 1 : -1;

  if (typeof move.mate === 'number') {
    const winner = move.mate * sign > 0 ? 'White' : 'Black';

    return `${winner} mates in ${Math.abs(move.mate)}`;
  }

  const pawns = (move.cp ?? 0) * sign / 100;

  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)} (White)`;
}

function whiteEvaluation(game: Chess, move?: MoveEval): string | number {
  if (game.isCheckmate())
    return game.turn() === 'w' ? '0-1' : '1-0';
  if (game.isDraw())
    return '1/2-1/2';
  const sign = game.turn() === 'w' ? 1 : -1;

  if (typeof move?.mate === 'number')
    return `${move.mate * sign > 0 ? '+' : '-'}M${Math.abs(move.mate)}`;

  return (move?.cp ?? 0) * sign;
}

function sanLine(fen: string, line: string[]) {
  const game = new Chess(fen);
  const moves: string[] = [];

  for (const lan of line.slice(0, 6)) {
    try {
      moves.push(game.move(lan).san);
    }
    catch {
      break;
    }
  }

  return moves;
}

export function alternativeLabel(before: MoveEval | undefined, after: MoveEval | undefined, move: Move, game: Chess) {
  if (game.isCheckmate())
    return 'Checkmate';
  if (!before)
    return game.isDraw() ? 'Draw' : 'Alternative move';
  if (before.pv === move.lan)
    return 'Best move';
  const resultingScore = game.isDraw() ? 0 : after ? -score(after) : 0;
  const loss = Math.max(0, score(before) - resultingScore);

  return loss < 25 ? 'Excellent move' : loss < 75 ? 'Good move' : loss < 150 ? 'Inaccuracy' : loss < 300 ? 'Mistake' : 'Blunder';
}

export const useVariationStore = create<VariationStore>((set, get) => ({
  fen: null,
  moves: [],
  status: 'idle',
  feedback: null,
  error: null,
  play: (sourceFen, from, to, promotion) => {
    const beforeFen = get().fen ?? sourceFen;
    const game = new Chess(beforeFen);
    let move: Move;

    try {
      move = game.move({ from, to, ...(promotion ? { promotion } : {}) });
    }
    catch {
      return;
    }

    activeAnalysis?.abort();
    const controller = new AbortController();
    activeAnalysis = controller;
    set({ fen: game.fen(), moves: [...get().moves, move], status: 'analyzing', feedback: null, error: null });

    void (async () => {
      try {
        const before = await analyzePosition(beforeFen, { signal: controller.signal, multiPv: 1 });
        if (controller.signal.aborted)
          return;
        const after = game.isGameOver() ? [] : await analyzePosition(game.fen(), { signal: controller.signal, multiPv: 1 });

        if (controller.signal.aborted)
          return;
        const bestMove = before[0] ? sanLine(beforeFen, [before[0].pv])[0] ?? before[0].pv : '';

        set({
          status: 'ready',
          feedback: {
            label: alternativeLabel(before[0], after[0], move, game),
            evaluation: evaluationLabel(game, after[0]),
            whiteEvaluation: whiteEvaluation(game, after[0]),
            bestMove,
            continuation: sanLine(game.fen(), after[0]?.line ?? (after[0] ? [after[0].pv] : [])),
          },
        });
      }
      catch (error) {
        if (!controller.signal.aborted)
          set({ status: 'error', error: error instanceof Error ? error.message : 'Could not analyze this position.' });
      }
    })();
  },
  reset: () => {
    activeAnalysis?.abort();
    activeAnalysis = null;
    set({ fen: null, moves: [], status: 'idle', feedback: null, error: null });
  },
}));
