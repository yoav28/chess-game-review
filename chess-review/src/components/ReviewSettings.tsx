import { useId } from 'react'
import { normalizeSettings, type Settings } from '../lib/settings'
import './ReviewSettings.css'

type ToggleKey = 'sound' | 'showClassifications' | 'autoplayExplanation' | 'showCoachAvatar' | 'showRecommendations' | 'showSkills' | 'showTimeSpent'

export function ReviewSettings({ settings, onChange, onDone }: { settings: Settings; onChange: (settings: Settings) => void; onDone: () => void }) {
  const id = useId()
  const update = (patch: Partial<Settings>) => onChange(normalizeSettings({ ...settings, ...patch }))
  const toggle = (key: ToggleKey, label: string) => <label className="checkbox-label"><input type="checkbox" checked={settings[key]} onChange={event => update({ [key]: event.target.checked })} />{label}</label>
  const times = [150, 500, 1500, 5000]

  return <div className="review-settings">
    <fieldset>
      <legend>Engine</legend>
      <label htmlFor={`${id}-depth`}>Maximum depth<strong>{settings.depth}</strong></label>
      <input id={`${id}-depth`} type="range" min="10" max="22" value={settings.depth} onChange={event => update({ depth: Number(event.target.value) })} />
      <label htmlFor={`${id}-time`}>Time per position</label>
      <select id={`${id}-time`} value={settings.timeMs} onChange={event => update({ timeMs: Number(event.target.value) })}>
        {!times.includes(settings.timeMs) && <option value={settings.timeMs}>Custom · {settings.timeMs / 1000} seconds</option>}
        <option value="150">Quick · 0.15 seconds</option>
        <option value="500">Balanced · 0.5 seconds</option>
        <option value="1500">Deep · 1.5 seconds</option>
        <option value="5000">Thorough · 5 seconds</option>
      </select>
      <p className="fine-print">Analysis stops at the depth or time limit. These limits apply to the next review; saved reviews stay available.</p>
    </fieldset>
    <fieldset>
      <legend>Board and moves</legend>
      <label htmlFor={`${id}-arrows`}>Arrows</label>
      <select id={`${id}-arrows`} value={settings.arrowMode} onChange={event => update({ arrowMode: event.target.value as Settings['arrowMode'] })}>
        <option value="best">Best move</option><option value="coach">Coach continuation</option><option value="both">Best move and coach</option><option value="none">None</option>
      </select>
      <label htmlFor={`${id}-highlight`}>Highlight moves by</label>
      <select id={`${id}-highlight`} value={settings.highlight} onChange={event => update({ highlight: event.target.value as Settings['highlight'] })}>
        <option value="all">Both players</option><option value="self">Imported username</option><option value="opponent">Opponent</option>
      </select>
      <p className="fine-print">Player selection uses the imported Chess.com username. Without one, both players are highlighted.</p>
      {toggle('showClassifications', 'Show classification icons on the board')}
      {toggle('showTimeSpent', 'Show time spent on each move')}
      {toggle('sound', 'Move sounds')}
    </fieldset>
    <fieldset>
      <legend>Coach</legend>
      <label htmlFor={`${id}-detail`}>Explanation detail</label>
      <select id={`${id}-detail`} value={settings.coachDetail} onChange={event => update({ coachDetail: event.target.value as Settings['coachDetail'] })}>
        <option value="concise">Concise</option><option value="detailed">Detailed</option>
      </select>
      {toggle('showCoachAvatar', 'Show coach avatar')}
      {toggle('autoplayExplanation', 'Autoplay explanations')}
      <label htmlFor={`${id}-delay`}>Time between explanation steps<strong>{settings.explanationDelayMs / 1000}s</strong></label>
      <input id={`${id}-delay`} type="range" min="500" max="5000" step="100" value={settings.explanationDelayMs} onChange={event => update({ explanationDelayMs: Number(event.target.value) })} />
      <p className="fine-print">Reduced-motion preferences keep explanations paused until you press Play.</p>
      {toggle('showRecommendations', 'Show training recommendations')}
      {toggle('showSkills', 'Show skill breakdown')}
    </fieldset>
    <button className="primary full-width" onClick={onDone}>Done</button>
  </div>
}
