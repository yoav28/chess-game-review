import useAdvancedStats from '../../hooks/useAdvancedStats';
import ReviewAllStats from './ReviewAllStats';
import ReviewPhaseAssessment from './ReviewPhaseAssessment';

import '../../styles/review-phase-summary.css';

export default function ReviewPhaseSummary() {
  const stats = useAdvancedStats();

  return (
    <div className="review-phase-summary">
      <div className="review-phase-row review-rating-row">
        <span className="review-phase-label">Game Rating</span>
        {['White', 'Black'].map((color, index) => {
          const { rating, ratingSource } = stats[index];
          const estimated = ratingSource === 'estimate';

          return (
            <strong
              aria-label={`${color} ${estimated ? 'estimated ' : ''}game rating${rating === null ? ' unavailable' : ` ${rating}`}`}
              className="review-game-rating"
              data-color={index}
              key={color}
              title={ratingSource === 'metadata' ? 'Performance rating from game metadata' : estimated ? 'Approximate game rating based on decision accuracy and imported player rating. See View All Stats for the calculation.' : 'Requires analyzed moves and a player rating, or explicit performance-rating metadata.'}
            >
              {estimated && '≈'}
              {rating ?? '—'}
            </strong>
          );
        })}
      </div>
      <section
        aria-labelledby="review-advanced-heading"
        className="review-advanced-stats"
      >
        <h2 id="review-advanced-heading">Advanced Stats</h2>
        {(['Opening', 'Tactics', 'Strategy'] as const).map(phase => (
          <div className="review-phase-row" key={phase}>
            <span className="review-phase-label">{phase}</span>
            {['White', 'Black'].map((color, index) => (
              <ReviewPhaseAssessment assessment={stats[index].phases[phase]} index={index} key={color} phase={phase} player={color} />
            ))}
          </div>
        ))}
        <ReviewAllStats />
      </section>
      <a className="review-new-game" href="https://www.chess.com/play/online/new?time=5%7C0" rel="noopener noreferrer" target="_blank">New 5 min</a>
    </div>
  );
}
