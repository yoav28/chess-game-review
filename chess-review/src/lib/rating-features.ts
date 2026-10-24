import type { Color } from 'chess.js'
import type { GameReview } from './review'
import { winningChance } from './accuracy'

export const ratingFeatureNames = ['meanLoss', 'rmsLoss', 'largeErrorFraction', 'nearBestFraction', 'meanLegalMoveLog2', 'contestedFraction', 'contestedMeanLoss'] as const
export const ratingAnalysisProfile = { engine: 'Stockfish 19 lite single thread', depth: 10, timeMs: 30, multiPv: 2, accuracyVersion: 2 } as const
export const ratingProfileId = 'stockfish19-lite-d10-t30-mpv2-winchance-v2'

export interface RatingFeatures {
  decisions: number
  contestedDecisions: number
  values: number[]
}

export interface RatingObservation extends RatingFeatures {
  gameId: string
  playerId: string
  opponentId: string
  recordedRating: number
  timeClass: string
  profile: string
}

export function ratingFeatures(review: GameReview, color: Color): RatingFeatures | null {
  if (review.accuracyVersion !== 2 || review.variant === 'chess960') return null
  const moves = review.moves.filter(move => move.color === color && move.ply > 8 && move.legalMoves > 1 && move.classification !== 'book'
    && Number.isFinite(move.winningChanceLoss) && move.winningChanceLoss! >= 0 && move.winningChanceLoss! <= 100)
  if (moves.length < 12) return null
  const contested = moves.filter(move => { const chance = winningChance(move.beforeEvaluation, color); return chance >= 20 && chance <= 80 })
  if (contested.length < 8) return null
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const losses = moves.map(move => move.winningChanceLoss!)
  return {
    decisions: moves.length, contestedDecisions: contested.length,
    values: [mean(losses), Math.sqrt(mean(losses.map(loss => loss * loss))), losses.filter(loss => loss > 10).length / moves.length,
      losses.filter(loss => loss <= 0.5).length / moves.length, mean(moves.map(move => Math.log2(move.legalMoves))), contested.length / moves.length,
      mean(contested.map(move => move.winningChanceLoss!))],
  }
}
