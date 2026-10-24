import { useId } from 'react'
import type { Settings } from '../lib/settings'
import { analysisTimeLimits } from '../engine/search-options'
import { ThreadCountControl } from './ThreadCountControl'

export function AnalysisSettingsFields({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const id = useId()
  return <div className="analysis-settings-fields">
    <label htmlFor={`${id}-time`}>Maximum time</label>
    <select id={`${id}-time`} value={settings.analysisTimeMs} onChange={event => onChange({ analysisTimeMs: Number(event.target.value) })}>{analysisTimeLimits.map(time => <option key={time} value={time}>{time ? `${time / 1000} seconds` : 'Unlimited · stop manually'}</option>)}</select>
    <ThreadCountControl value={settings.analysisThreads} label="Threads" onChange={analysisThreads => onChange({ analysisThreads })} />
    <label htmlFor={`${id}-lines`}>Analysis lines</label>
    <select id={`${id}-lines`} value={settings.analysisLines} onChange={event => onChange({ analysisLines: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map(count => <option key={count} value={count}>{count} {count === 1 ? 'line' : 'lines'}</option>)}</select>
    <p className="fine-print">These controls apply to position analysis. Game reviews, practice, and engine play keep their own search budgets.</p>
  </div>
}
