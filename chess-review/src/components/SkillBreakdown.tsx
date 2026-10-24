import { skillSummaries } from "../lib/report";
import type { GameReview } from "../lib/review";

export function SkillBreakdown({ review }: { review: GameReview }) {
  const skills = skillSummaries(review);
  return (
    <section className="skill-report">
      <h3>Performance by skill</h3>
      <div className="skill-header">
        <span>Move accuracy</span>
        <span>White</span>
        <span>Black</span>
      </div>
      {skills.categories.map((category) => (
        <div className="skill-row" key={category.key}>
          <span title={category.description}>{category.label}</span>
          {[category.white, category.black].map((player, index) => (
            <span key={index} title={`${player.moves} qualifying moves`}>
              {player.accuracy?.toFixed(1) ?? "—"}
            </span>
          ))}
        </div>
      ))}
      <details>
        <summary>How categories work</summary>
        <p>{skills.method}</p>
      </details>
    </section>
  );
}
