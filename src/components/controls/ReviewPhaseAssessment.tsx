import MoveClassification from '../../icons/move-classifications/MoveClassification';

import type { PhaseAssessment } from '../../utils/getAdvancedStats';

export default function ReviewPhaseAssessment({ player, phase, assessment, index }: { player: string; phase: string; assessment: PhaseAssessment; index: number }) {
  const { accuracy, moveCount } = assessment;
  const classification = accuracy === null ? null : accuracy >= 90 ? 'best' : accuracy >= 80 ? 'excellent' : accuracy >= 65 ? 'good' : accuracy >= 50 ? 'inaccuracy' : accuracy >= 35 ? 'mistake' : 'blunder';
  const description = accuracy === null ? 'No analyzed moves in this category.' : `${accuracy.toFixed(1)}% accuracy across ${moveCount} ${moveCount === 1 ? 'move' : 'moves'}.`;

  return (
    <span
      aria-label={`${player} ${phase.toLowerCase()} assessment ${accuracy === null ? 'unavailable' : `${accuracy.toFixed(1)}% accuracy`}`}
      className="review-phase-value"
      data-color={index}
      title={description}
    >
      {classification ? <MoveClassification classification={classification} /> : '—'}
    </span>
  );
}
