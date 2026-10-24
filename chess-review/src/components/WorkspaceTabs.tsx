import { useRef } from 'react'

export type WorkspaceTab = 'review' | 'analysis' | 'practice' | 'history'
const tabs: { key: WorkspaceTab; label: string }[] = [
  { key: 'review', label: 'Review' }, { key: 'analysis', label: 'Analysis' },
  { key: 'practice', label: 'Practice' }, { key: 'history', label: 'Saved' },
]

export function WorkspaceTabs({ tab, onChange }: { tab: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  return <div className="inspector-tabs" role="tablist" aria-label="Review workspace">
    {tabs.map((item, index) => <button key={item.key} ref={element => { buttons.current[index] = element }}
      id={`workspace-tab-${item.key}`} role="tab" aria-selected={tab === item.key} aria-controls="workspace-panel"
      tabIndex={tab === item.key ? 0 : -1} onClick={() => onChange(item.key)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
          : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
        if (next === null) return
        event.preventDefault()
        event.stopPropagation()
        onChange(tabs[next].key)
        buttons.current[next]?.focus()
      }}>{item.label}</button>)}
  </div>
}
