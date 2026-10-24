import { useId } from 'react'
import type { Settings } from '../lib/settings'
import { analysisTimeLimits, browserThreadLimit } from '../engine/search-options'

export function AnalysisSettingsFields({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const id = useId()
  const available = browserThreadLimit()
  return <div className="analysis-settings-fields">
    <label htmlFor={`${id}-time`}>Maximum time</label>
    <select id={`${id}-time`} value={settings.analysisTimeMs} onChange={event => onChange({ analysisTimeMs: Number(event.target.value) })}>{analysisTimeLimits.map(time => <option key={time} value={time}>{time ? `${time / 1000} seconds` : 'Unlimited · stop manually'}</option>)}</select>
    <label htmlFor={`${id}-threads`}>Threads</label>
    <select id={`${id}-threads`} value={settings.analysisThreads} onChange={event => onChange({ analysisThreads: Number(event.target.value) })}>{Array.from({ length: 8 }, (_, index) => index + 1).map(count => <option key={count} value={count} disabled={count > available}>{count} {count === 1 ? 'thread' : 'threads'}{count > available ? ' · unavailable' : ''}</option>)}</select>
    <label htmlFor={`${id}-lines`}>Analysis lines</label>
    <select id={`${id}-lines`} value={settings.analysisLines} onChange={event => onChange({ analysisLines: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map(count => <option key={count} value={count}>{count} {count === 1 ? 'line' : 'lines'}</option>)}</select>
    {settings.analysisThreads > available && <p className="fine-print">This browser supports up to {available} {available === 1 ? 'thread' : 'threads'}; this search will use {available}.</p>}
    <p className="fine-print">These controls apply to position analysis. Game reviews, practice, and engine play keep their own search budgets.</p>
  </div>
}
