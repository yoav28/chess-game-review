import { classificationLabels, type MoveReview } from './review'
import { insightsForMove } from './insights'
import { createPosition, positionMoveUci } from './position'

export type CoachDetail = 'concise' | 'detailed'
export type CoachProfile = 'clear' | 'supportive' | 'analyst'

export const coachProfiles: Record<CoachProfile, { label: string; description: string; speechRate: number; speechPitch: number }> = {
  clear: { label: 'Clear', description: 'Direct explanations of the move and engine choice.', speechRate: 0.95, speechPitch: 1 },
  supportive: { label: 'Supportive', description: 'Step-by-step prompts for comparing the board.', speechRate: 0.88, speechPitch: 1.05 },
  analyst: { label: 'Analyst', description: 'Engine depth and recorded loss alongside the chess idea.', speechRate: 1.05, speechPitch: 0.95 },
}

function engineChoice(move: MoveReview): { san: string | null; forced: boolean } {
  try {
    const legal = createPosition(move.beforeFen, move.variant).moves({ verbose: true })
    return { san: legal.find(candidate => positionMoveUci(candidate) === move.bestMove)?.san ?? null, forced: legal.length === 1 }
  } catch {
    return { san: null, forced: false }
  }
}

function analysisFacts(move: MoveReview): string {
  const facts: string[] = []
  if (Number.isInteger(move.depth) && move.depth > 0) facts.push(`Search depth ${move.depth}.`)
  if (typeof move.winningChanceLoss === 'number' && Number.isFinite(move.winningChanceLoss) && move.winningChanceLoss >= 0) {
    facts.push(`Recorded winning-chance loss: ${Number(move.winningChanceLoss.toFixed(2))} percentage points.`)
  } else if (Number.isFinite(move.centipawnLoss) && move.centipawnLoss >= 0) {
    facts.push(`Recorded centipawn loss: ${move.centipawnLoss}.`)
  }
  return facts.join(' ')
}

export function coachText(move: MoveReview, detail: CoachDetail, profile: CoachProfile = 'clear'): string {
  if (detail === 'detailed') {
    if (profile === 'supportive') return `Take this one move at a time. ${move.explanation} Replay the position to compare the board before and after the move.`
    if (profile === 'analyst') return [analysisFacts(move), move.explanation].filter(Boolean).join(' ')
    return move.explanation
  }
  const idea = insightsForMove(move)[0]
  const best = engineChoice(move)
  const choice = best.san && move.bestMove !== move.uci
    ? profile === 'supportive' ? `Compare it with ${best.san}, the engine’s first choice.` : `The engine preferred ${best.san}.`
    : best.forced ? 'This was the only legal move.' : best.san && move.bestMove === move.uci ? 'This follows the engine’s first choice.' : 'No engine alternative was recorded for this position.'
  const label = classificationLabels[move.classification].toLowerCase()
  if (profile === 'supportive') return [`Let’s look at ${move.san} (${label}).`, idea ? `Notice the board: ${idea}` : null, choice].filter(Boolean).join(' ')
  if (profile === 'analyst') return [`${move.san}: ${label}.`, analysisFacts(move), idea, choice].filter(Boolean).join(' ')
  return [`${move.san}: ${label}.`, idea, choice].filter(Boolean).join(' ')
}
