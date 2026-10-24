import '../../styles/review-phase-summary.css';

export default function ReviewPhaseSummary({ header }: { header: Record<string, string> }) {
  return (
    <div className="review-phase-summary">
      <div className="review-phase-row">
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
      {['Opening', 'Middlegame'].map(phase => (
        <div className="review-phase-row" key={phase}>
          <span className="review-phase-label">{phase}</span>
          {['White', 'Black'].map((color, index) => (
            <span
              aria-label={`${color} ${phase.toLowerCase()} assessment unavailable`}
              className="review-phase-value"
              data-color={index}
              key={color}
              title={`${phase} phase assessment is not available for this game.`}
            >
              —
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
