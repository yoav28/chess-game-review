import { useId } from 'react'
import { browserThreadLimit } from '../engine/search-options'

export function ThreadCountControl({ value, label, onChange }: { value: number; label: string; onChange: (threads: number) => void }) {
  const id = useId()
  const available = browserThreadLimit()
  return <>
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={event => onChange(Number(event.target.value))}>{Array.from({ length: 8 }, (_, index) => index + 1).map(count => <option key={count} value={count} disabled={count > available}>{count} {count === 1 ? 'thread' : 'threads'}{count > available ? ' · unavailable' : ''}</option>)}</select>
    {value > available && <p className="fine-print">This browser supports up to {available} {available === 1 ? 'thread' : 'threads'}; this search will use {available}.</p>}
  </>
}
