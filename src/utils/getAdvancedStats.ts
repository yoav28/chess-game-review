import { Chess, DEFAULT_POSITION } from 'chess.js';

import type { Classification } from './classify';

export interface PhaseAssessment {
  accuracy: number | null;
  moveCount: number;
  averageLoss: number | null;
}
export interface PlayerAdvancedStats {
  rating: number | null;
  ratingSource: 'metadata' | 'estimate' | null;
  accuracy: number | null;
  moveCount: number;
  phases: Record<'Opening' | 'Tactics' | 'Strategy', PhaseAssessment>;
}

function chance(value: number | string | undefined): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? 100 / (1 + Math.exp(-0.00368208 * value)) : null;
  if (value === '1/2-1/2')
    return 50;
  if (value === '1-0' || /^\+M\d+$/.test(value ?? ''))
    return 100;
  if (value === '0-1' || /^-M\d+$/.test(value ?? ''))
    return 0;

  return null;
}

function summarize(losses: number[]): PhaseAssessment {
  if (!losses.length)
    return { accuracy: null, moveCount: 0, averageLoss: null };

  const accuracy = losses.reduce((sum, loss) => sum + (loss ? 99.99 * Math.exp(-0.14 * loss) : 100), 0) / losses.length;
  const averageLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;

  return {
    accuracy: Number(Math.max(0, Math.min(100, accuracy)).toFixed(1)),
    moveCount: losses.length,
    averageLoss: Number(averageLoss.toFixed(1)),
  };
}

function positive(value: string | undefined): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getAdvancedStats(game: Chess, cps: (number | string)[], classHistory: Classification[]): [PlayerAdvancedStats, PlayerAdvancedStats] {
  const history = game.history({ verbose: true });
  const standardStart = (history[0]?.before ?? game.header().FEN ?? game.fen()) === DEFAULT_POSITION;
  const samples = [0, 1].map(() => ({ all: [] as number[], Opening: [] as number[], Tactics: [] as number[], Strategy: [] as number[] }));

  history.forEach((move, index) => {
    const before = chance(cps[index]);
    const after = chance(cps[index + 1]);
    if (before === null || after === null || classHistory[index] === 'forced' || new Chess(move.before).moves().length === 1)
      return;

    const side = samples[move.color === 'w' ? 0 : 1];
    const loss = Math.max(0, (before - after) * (move.color === 'w' ? 1 : -1));
    const opening = standardStart && index < 20;
    const tactical = Boolean(move.captured || move.promotion || /[+#]/.test(move.san) || classHistory[index] === 'great' || classHistory[index] === 'brilliant');
    side.all.push(loss);
    if (opening)
      side.Opening.push(loss);
    if (tactical)
      side.Tactics.push(loss);
    if (!opening && !tactical)
      side.Strategy.push(loss);
  });

  const header = game.header();

  return samples.map((side, index) => {
    const { accuracy, moveCount } = summarize(side.all);
    const color = index === 0 ? 'White' : 'Black';
    const performance = positive(header[`${color}PerformanceRating`]);
    const elo = positive(header[`${color}Elo`]);
    const estimate = elo !== null && accuracy !== null ? Math.round(Math.max(100, Math.min(3200, elo + 20 * (accuracy - 75))) / 50) * 50 : null;

    return {
      rating: performance ?? estimate,
      ratingSource: performance !== null ? 'metadata' : estimate !== null ? 'estimate' : null,
      accuracy,
      moveCount,
      phases: { Opening: summarize(side.Opening), Tactics: summarize(side.Tactics), Strategy: summarize(side.Strategy) },
    };
  }) as [PlayerAdvancedStats, PlayerAdvancedStats];
}
