import { classificationLabels, type Classification, type GameReview } from "../lib/review";
import MoveClassification from "./move-classifications/MoveClassification";

type ReviewStatsProps = {
  review: GameReview;
  ply?: number;
  onSelect: (ply: number) => void;
};

export function ReviewStats({ review, ply, onSelect }: ReviewStatsProps) {
  const categories = Object.keys(classificationLabels) as Classification[];
  return (
    <>
      <section className="classification-report">
        <div className="classification-header">
          <span>Move quality</span>
          <span>White</span>
          <span>Black</span>
        </div>
        {categories.map((category) => (
          <div className="classification-row" key={category}>
            <span>
              <MoveClassification className="review-classification-icon" classification={category} />
              {classificationLabels[category]}
            </span>
            {(["w", "b"] as const).map((color) => (
              <button
                key={color}
                disabled={!review.counts[color][category]}
                title={`Find ${color === "w" ? "White" : "Black"} ${classificationLabels[category].toLowerCase()} moves`}
                onClick={() => {
                  const matches = review.moves.filter(
                    (m) =>
                      m.color === color && m.classification === category,
                  );
                  const next =
                    matches.find((m) => m.ply > (ply ?? 0)) ??
                    matches[0];
                  if (next) onSelect(next.ply);
                }}
              >
                {review.counts[color][category]}
              </button>
            ))}
          </div>
        ))}
      </section>
      <section className="phase-report">
        <h3>Game phases</h3>
        {review.phases.map((phase) => (
          <div key={phase.phase}>
            <span>{phase.phase}</span>
            <strong>{phase.whiteAccuracy?.toFixed(1) ?? "—"}</strong>
            <strong>{phase.blackAccuracy?.toFixed(1) ?? "—"}</strong>
          </div>
        ))}
      </section>
    </>
  );
}
