import type { Color } from 'chess.js'
import type { Evaluation } from '../engine/types'

export const accuracySource = 'https://lichess.org/page/accuracy'

export function winningChance(evaluation: Evaluation, mover: Color = 'w'): number {
  if (!Number.isFinite(evaluation.cp) || evaluation.mate !== null && !Number.isFinite(evaluation.mate)) throw new Error('Accuracy requires a finite engine evaluation.')
  let white: number
  if (evaluation.mate !== null) {
    if (evaluation.mate === 0 && evaluation.cp === 0) throw new Error('A checkmate evaluation must identify the winning side.')
    white = (evaluation.mate === 0 ? evaluation.cp > 0 : evaluation.mate > 0) ? 100 : 0
  } else white = 100 / (1 + Math.exp(-0.00368208 * evaluation.cp))
  return mover === 'w' ? white : 100 - white
}

export function winningChanceLoss(before: Evaluation, after: Evaluation, mover: Color): number {
  return Math.max(0, winningChance(before, mover) - winningChance(after, mover))
}

export function moveAccuracy(lossPercentagePoints: number): number {
  if (!Number.isFinite(lossPercentagePoints)) throw new Error('Accuracy requires a finite winning-chance loss.')
  const accuracy = 103.1668 * Math.exp(-0.04354 * Math.max(0, lossPercentagePoints)) - 3.1669
  return Math.round(Math.max(0, Math.min(100, accuracy)) * 10) / 10
}

export const accuracyMethod = `Move accuracy uses Lichess’s published win-chance model (${accuracySource}): Win%=100/(1+exp(-0.00368208×cp)); Accuracy=clamp(103.1668×exp(-0.04354×loss)−3.1669,0,100), with loss measured in percentage points for the mover. Forced mates map to 100% or 0% by the winning side. Best moves and only legal moves have zero loss to avoid penalties from search-depth noise. Game and phase scores are arithmetic means of move scores, unlike Lichess’s weighted whole-game score. These are independent scores, not Chess.com’s formula. Our labels use loss thresholds: Excellent ≤0.5, Good ≤5, Inaccuracy ≤10, Mistake ≤20, Blunder >20 points. Missed opportunity means a previously found mate falls below 90% winning chance, or a chance of at least 60% falls to at most 50% with at least 10 points lost.`
