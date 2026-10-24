import { classificationLabels, type MoveReview } from './review'
import { insightsForMove } from './insights'

export type CoachDetail = 'concise' | 'detailed'

export function coachText(move: MoveReview, detail: CoachDetail): string {
  if (detail === 'detailed') return move.explanation
  const idea = insightsForMove(move)[0]
  const choice = move.bestMoveSan && move.bestMove !== move.uci
    ? `The engine preferred ${move.bestMoveSan}.`
    : move.classification === 'forced' ? 'This was the only legal move.' : move.bestMove === move.uci ? 'This follows the engine’s first choice.' : 'No engine alternative was recorded for this position.'
  return [`${move.san}: ${classificationLabels[move.classification].toLowerCase()}.`, idea, choice].filter(Boolean).join(' ')
}
