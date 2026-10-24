import { Chess } from 'chess.js';

import type { MoveEvalMerged } from '../stores/useEvalStore';
import type { Move, PieceSymbol, Square } from 'chess.js';

const values: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 20000 };

export function evaluationScore(value: string | number) {
  if (typeof value === 'number')
    return value;
  if (value === '1/2-1/2')
    return 0;
  if (value === '1-0')
    return 100000;
  if (value === '0-1')
    return -100000;
  const distance = Number(value.replace(/[+-]?M/, '')) || 0;

  return (value.startsWith('-') ? -1 : 1) * (100000 - distance * 100);
}

function exchangeGain(chess: Chess, square: Square, remaining = 12): number {
  if (!remaining)
    return 0;
  let gain = 0;

  for (const capture of chess.moves({ verbose: true }).filter(move => move.to === square && move.captured)) {
    chess.move(capture.san);
    gain = Math.max(gain, values[capture.captured!] - exchangeGain(chess, square, remaining - 1));
    chess.undo();
  }

  return gain;
}

export function isPieceSacrifice(fen: string, lan: string) {
  const chess = new Chess(fen);
  let move: Move;

  try {
    move = chess.move({ from: lan.slice(0, 2), to: lan.slice(2, 4), promotion: lan[4] });
  }
  catch {
    return false;
  }

  if (move.piece === 'p' || move.piece === 'k' || move.promotion)
    return false;
  const gained = move.captured ? values[move.captured] : 0;

  return exchangeGain(chess, move.to) - gained >= 200;
}

export function specialClassification(fen: string, lan: string, alternatives: MoveEvalMerged[], afterEval: string | number) {
  const sign = new Chess(fen).turn() === 'w' ? 1 : -1;
  const best = alternatives[0];
  if (!best)
    return;
  const bestScore = evaluationScore(best.eval) * sign;
  const playedScore = evaluationScore(afterEval) * sign;
  const secondScore = alternatives[1] ? evaluationScore(alternatives[1].eval) * sign : undefined;
  const nearlyBest = bestScore - playedScore <= 25;
  if (nearlyBest && playedScore >= -50 && secondScore !== undefined && secondScore < 300 && isPieceSacrifice(fen, lan))
    return 'brilliant' as const;
  if (lan === best.pv && secondScore !== undefined && bestScore >= -50 && bestScore - secondScore >= 150)
    return 'great' as const;
}
