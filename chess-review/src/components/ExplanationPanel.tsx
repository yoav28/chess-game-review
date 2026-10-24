import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import type { Explanation } from '../hooks/useExplanation'
import './ExplanationPanel.css'

export function ExplanationPanel({ explanation, onExit }: { explanation: Explanation; onExit: () => void }) {
  const step = explanation.steps[explanation.currentStep]
  if (!explanation.active || !step) return null

  return <div className="analysis-content explanation-content">
    <div className="report-caption"><h2>Move explanation</h2><span>{explanation.currentStep + 1} / {explanation.steps.length}</span></div>
    <section className="explanation-step" aria-live="polite" aria-atomic="true">
      <h3>{step.heading}{step.san && <span>{step.san}</span>}</h3>
      <p>{step.caption}</p>
    </section>
    <div className="explanation-controls" aria-label="Explanation playback">
      <button className="secondary" disabled={explanation.currentStep === 0} onClick={explanation.previous} aria-label="Previous explanation step"><ChevronLeft size={17} />Back</button>
      <button className="secondary" onClick={explanation.playing ? explanation.pause : explanation.play}>{explanation.playing ? <Pause size={16} /> : <Play size={16} />}{explanation.playing ? 'Pause' : 'Play'}</button>
      <button className="secondary" disabled={explanation.currentStep === explanation.steps.length - 1} onClick={explanation.next} aria-label="Next explanation step">Next<ChevronRight size={17} /></button>
    </div>
    <div className="explanation-footer">
      <button className="text-button" onClick={explanation.reset}><RotateCcw size={15} />Start over</button>
      <button className="primary" onClick={() => { explanation.stop(); onExit() }}><Check size={16} />Got it</button>
    </div>
  </div>
}
