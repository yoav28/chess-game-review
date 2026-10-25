import type { GameReview } from "../lib/review";
import type { Evaluation } from "../engine/types";
import type { ChessVariant } from "../lib/position";

export function evaluationLabel(evaluation?: Evaluation | null, variant?: ChessVariant) {
  if (!evaluation) return "—";
  const variantScore = variant === 'threecheck' || variant === 'kingofthehill' || variant === 'atomic' || variant === 'horde' || variant === 'giveaway';
  if (evaluation.mate !== null)
    return evaluation.mate === 0 ? variantScore ? 'Win' : '#' : `${variantScore ? 'W' : 'M'}${Math.abs(evaluation.mate)}`;
  return `${evaluation.cp >= 0 ? "+" : ""}${(evaluation.cp / 100).toFixed(1)}`;
}

export function EvaluationGraph({
  review,
  ply,
  onSelect,
}: {
  review: GameReview | null;
  ply: number;
  onSelect: (ply: number) => void;
}) {
  if (!review)
    return (
      <div className="graph-placeholder">
        <span>Evaluation timeline</span>
        <span>Run a review to see the turning points.</span>
        <div />
      </div>
    );
  const values = [
    review.initialAnalysis.evaluation,
    ...review.moves.map((move) => move.evaluation),
  ];
  const width = 600;
  const height = 80;
  const x = (index: number) => (index / Math.max(1, values.length - 1)) * width;
  const y = (evaluation: Evaluation) =>
    height / 2 - Math.tanh(evaluation.cp / 450) * (height / 2 - 5);
  const points = values
    .map((value, index) => `${x(index)},${y(value)}`)
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <div className="evaluation-graph">
      <div className="graph-heading">
        <span>Evaluation</span>
        <span>White ↑ · Black ↓</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Game evaluation graph"
      >
        <polygon points={area} fill="var(--board-light)" opacity=".18" />
        <line
          x1="0"
          y1="40"
          x2="600"
          y2="40"
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        {review.keyMoments.map((moment) => (
          <circle
            key={moment}
            cx={x(moment)}
            cy={y(values[moment])}
            r="3"
            fill="var(--bad)"
          />
        ))}
        <line
          x1={x(ply)}
          y1="0"
          x2={x(ply)}
          y2={height}
          stroke="var(--text)"
          strokeWidth="1"
        />
        <circle cx={x(ply)} cy={y(values[ply])} r="4" fill="var(--text)" />
      </svg>
      <input
        type="range"
        min="0"
        max={values.length - 1}
        value={ply}
        onChange={(e) => onSelect(Number(e.target.value))}
        aria-label="Move on evaluation timeline"
      />
      <div className="graph-axis">
        <span>Start</span>
        <span>{Math.ceil(review.moves.length / 2)} moves</span>
      </div>
    </div>
  );
}
