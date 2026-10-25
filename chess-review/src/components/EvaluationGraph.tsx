import type { GameReview } from "../lib/review";
import type { Evaluation } from "../engine/types";
import type { ChessVariant } from "../lib/position";

const classificationColors = {
  brilliant: "#26c2a3",
  great: "#749bbf",
  book: "#d5a47d",
  best: "#81b64c",
  excellent: "#81b64c",
  good: "#95b776",
  inaccuracy: "#f7c631",
  mistake: "#ffa459",
  blunder: "#fa412d",
  missed: "#ff7769",
  forced: "#96af8b",
} satisfies Record<GameReview["moves"][number]["classification"], string>;

export function evaluationLabel(evaluation?: Evaluation | null, variant?: ChessVariant) {
  if (!evaluation) return "—";
  const variantScore = variant === 'threecheck' || variant === 'kingofthehill' || variant === 'atomic' || variant === 'horde' || variant === 'giveaway' || variant === 'racingkings';
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
        <polygon points={area} fill="#3f3d39" opacity=".18" />
        <line
          x1="0"
          y1="40"
          x2="600"
          y2="40"
          stroke="#9b9a96"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        {review.moves.map((move, index) =>
          ["inaccuracy", "mistake", "blunder"].includes(move.classification) ? (
            <circle
              key={move.ply}
              cx={x(index + 1)}
              cy={y(values[index + 1])}
              r="4"
              fill={classificationColors[move.classification]}
            />
          ) : null,
        )}
        <line
          x1={x(ply)}
          y1="0"
          x2={x(ply)}
          y2={height}
          stroke={classificationColors[review.moves[ply - 1]?.classification ?? "forced"]}
          strokeWidth="3"
        />
        <circle
          cx={x(ply)}
          cy={y(values[ply])}
          r="5"
          fill={classificationColors[review.moves[ply - 1]?.classification ?? "forced"]}
        />
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
