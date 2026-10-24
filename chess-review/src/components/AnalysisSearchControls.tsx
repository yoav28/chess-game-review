import type { Settings } from '../lib/settings'
import { normalizeSettings } from '../lib/settings'
import { AnalysisSettingsFields } from './AnalysisSettingsFields'
import './AnalysisSearchControls.css'

export function AnalysisSearchControls({ settings, onChange, busy, stopped, threads, onStop, onRun }: { settings: Settings; onChange: (settings: Settings) => void; busy: boolean; stopped: boolean; threads: number; onStop: () => void; onRun: () => void }) {
  return <div className="analysis-search-controls">
    <div className="analysis-search-actions"><button className="secondary" onClick={busy ? onStop : onRun}>{busy ? 'Stop analysis' : 'Analyze again'}</button><span role="status">{busy ? 'Searching' : stopped ? 'Stopped' : 'Ready'} · {settings.analysisTimeMs ? `${settings.analysisTimeMs / 1000}s limit` : 'Unlimited'} · {threads} {threads === 1 ? 'thread' : 'threads'}</span></div>
    <details><summary>Engine controls</summary><AnalysisSettingsFields settings={settings} onChange={patch => onChange(normalizeSettings({ ...settings, ...patch }))} /></details>
  </div>
}
