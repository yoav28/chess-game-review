import { useId, useMemo, useState } from 'react'
import { skillSummaries } from "../lib/report";
import { skillTabs, skillThemeGroup, type SkillTab } from '../lib/skill-themes'
import type { GameReview } from "../lib/review";

export function SkillBreakdown({ review, onSelect }: { review: GameReview; onSelect?: (ply: number) => void }) {
  const skills = skillSummaries(review);
  const [selectedTab, setSelectedTab] = useState<SkillTab>('fundamentals')
  const id = useId()
  const active = useMemo(() => skillThemeGroup(review, selectedTab), [review, selectedTab])
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
      <div className="skill-theme-section">
        <h4>Skill themes</h4>
        <p className="fine-print">Counts are local board-pattern detections, not Chess.com Skill Points or a player rating. One move may appear in several themes.</p>
        <div className="skill-tabs" role="tablist" aria-label="Skill theme categories">
          {skillTabs.map(tab => <button type="button" role="tab" key={tab.key} id={`${id}-${tab.key}`} aria-selected={selectedTab === tab.key} aria-controls={`${id}-panel`} onClick={() => setSelectedTab(tab.key)}>{tab.label}</button>)}
        </div>
        <div id={`${id}-panel`} className="skill-theme-panel" role="tabpanel" aria-labelledby={`${id}-${selectedTab}`}>
          <div className="skill-header skill-theme-header"><span>Theme</span><span>White</span><span>Black</span></div>
          {active.themes.map(theme => <div className="skill-row skill-theme-row" key={theme.key}>
            <span title={theme.description}>{theme.label}</span>
            {(['w', 'b'] as const).map((color, index) => {
              const plies = theme.plies[color]
              return <span key={index} title={plies.length ? `Moves ${plies.join(', ')}` : 'No detected moves'}>
                {plies.length && onSelect ? <button type="button" className="text-button" aria-label={`Go to ${color === 'w' ? 'White' : 'Black'} move ${plies[0]}`} onClick={() => onSelect(plies[0])}>{plies.length}</button> : plies.length || '—'}
              </span>
            })}
          </div>)}
        </div>
      </div>
      <details>
        <summary>How categories work</summary>
        <p>{skills.method}</p>
      </details>
    </section>
  );
}
