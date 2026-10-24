import ReviewAllStats from './ReviewAllStats';

import '../../styles/review-phase-summary.css';

export default function ReviewPhaseSummary({ header }: { header: Record<string, string> }) {
  return (
    <div className="review-phase-summary">
      <div className="review-phase-row review-rating-row">
        <span className="review-phase-label">Game Rating</span>
        {['White', 'Black'].map((color, index) => {
          const metadata = header[`${color}PerformanceRating`]?.trim();
          const rating = metadata && Number.isFinite(Number(metadata)) ? metadata : null;

          return (
            <strong
              aria-label={`${color} game rating${rating ? ` ${rating}` : ' unavailable'}`}
              className="review-game-rating"
              data-color={index}
              key={color}
              title={rating ? 'Performance rating from game metadata' : 'Performance rating is not available for this game.'}
            >
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
        {['Opening', 'Tactics', 'Strategy'].map(phase => (
          <div className="review-phase-row" key={phase}>
            <span className="review-phase-label">{phase}</span>
            {['White', 'Black'].map((color, index) => {
              const assessment = header[`${color}${phase}Assessment`];

              return (
                <span
                  aria-label={`${color} ${phase.toLowerCase()} assessment ${assessment || 'unavailable'}`}
                  className="review-phase-value"
                  data-color={index}
                  key={color}
                  title={assessment ? 'Assessment from game metadata' : `${phase} assessment is not available for this game.`}
                >
                  {assessment || '—'}
                </span>
              );
            })}
          </div>
        ))}
        <ReviewAllStats />
      </section>
      <a className="review-new-game" href="https://www.chess.com/play/online/new?time=5%7C0" rel="noopener noreferrer" target="_blank">New 5 min</a>
    </div>
  );
}
