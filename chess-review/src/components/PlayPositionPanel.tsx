import { useId } from 'react'
import { ArrowLeft, LoaderCircle, RotateCcw, Undo2 } from 'lucide-react'
import type { PlayPosition } from '../hooks/usePlayPosition'
import './PlayPositionPanel.css'

export function PlayPositionPanel({ play, onExit }: { play: PlayPosition; onExit: () => void }) {
  const sideId = useId()
  const side = play.playerColor === 'w' ? 'White' : 'Black'
  const status = play.outcome ?? (play.thinking ? 'Stockfish is thinking…' : (play.turn === 'w' ? 'White' : 'Black') + (play.turn === play.playerColor ? ' to move. Your turn.' : ' to move. Engine reply paused.'))

  return <div className="analysis-content play-position-content">
    <div className="report-caption"><h2>Play this position</h2></div>
    <p className="muted">Continue against Stockfish 19 Lite, without a clock.</p>
    <div className="play-position-side"><label htmlFor={sideId}>Play as</label><select id={sideId} value={play.playerColor} onChange={event => play.setPlayerColor(event.target.value as 'w' | 'b')}><option value="w">White</option><option value="b">Black</option></select></div>
    <p className="play-position-status" role="status">{play.thinking && <LoaderCircle className="spin" size={16} />}{status}</p>
    {play.error && <div className="play-position-error"><p className="error-message" role="alert">{play.error}</p>{!play.thinking && play.turn !== play.playerColor && !play.outcome && <button className="secondary" onClick={play.retry}>Try engine again</button>}</div>}
    <p className="muted">You control {side.toLowerCase()}.{!play.outcome && (play.turn === play.playerColor ? ' Move a piece on the board to continue.' : ' Wait for the engine’s reply.')}</p>
    <div className="practice-actions"><button className="secondary" disabled={!play.canUndo} onClick={play.undo}><Undo2 size={15} />Undo turn</button><button className="secondary" onClick={play.restart}><RotateCcw size={15} />Restart</button></div>
    {play.historySans.length > 0 && <section className="play-position-moves"><h3>Continuation</h3><p>{play.historySans.join(' ')}</p></section>}
    <button className="text-button practice-exit" onClick={onExit}><ArrowLeft size={15} />Back to analysis</button>
  </div>
}
