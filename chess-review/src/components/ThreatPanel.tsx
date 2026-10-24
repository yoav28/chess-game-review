import { LoaderCircle } from 'lucide-react'
import type { ThreatAnalysis } from '../hooks/useThreatAnalysis'
import './ThreatPanel.css'

export function ThreatPanel({ threat }: { threat: ThreatAnalysis }) {
  const color = threat.result?.color ?? (threat.eligibility.eligible ? threat.eligibility.color : null)

  return <section className="threat-panel" aria-label="Hypothetical opponent threats">
    <div className="report-caption"><h2>Opponent threats</h2>{threat.active && <button className="text-button" onClick={threat.hide}>Hide</button>}</div>
    <p className="engine-empty">See the engine’s first choice if the opponent could move now. This hypothetical position passes the current turn and clears en passant; the game stays at its actual position.</p>
    {!threat.eligibility.eligible && <p className="library-notice">{threat.eligibility.reason}</p>}
    {!threat.active && <button className="secondary full-width" disabled={!threat.eligibility.eligible} onClick={() => void threat.show()}>Show threats</button>}
    {threat.running && <p className="threat-panel-status" role="status"><LoaderCircle size={15} className="spin" />Checking the hypothetical position…</p>}
    {threat.error && <><p className="error-message" role="alert">{threat.error}</p><button className="secondary" onClick={() => void threat.show()}>Try threat analysis again</button></>}
    {threat.result && <div className="threat-panel-result" aria-live="polite">
      <h3>If {color === 'w' ? 'White' : 'Black'} could move now</h3>
      {threat.result.firstMove ? <><p>Engine first choice: <strong>{threat.result.firstMove.san}</strong></p><p className="threat-panel-line">{threat.result.pvSan.join(' ')}</p><p className="fine-print">Depth {threat.result.depth} · Up to eight hypothetical half-moves. The red arrow belongs to this opponent-to-move position; this line cannot be played as a move in the actual game.</p></> : <p className="engine-empty">No legal opponent continuation was recorded at this search budget.</p>}
    </div>}
  </section>
}
