import { useEffect, useRef, useState } from 'react'
import { probeTablebase, tablebaseCategoryLabel, tablebaseEligibility, type TablebaseResult } from '../lib/tablebase'
import './TablebasePanel.css'

type Props = { fen: string; onMove: (uci: string) => void; disabled?: boolean }

function distance(value: number | null, precise: number | null) {
  return value === null ? 'Unknown' : `${precise === null ? '≈ ' : ''}${value > 0 ? '+' : ''}${value}`
}

export function TablebasePanel({ fen, onMove, disabled = false }: Props) {
  const [result, setResult] = useState<TablebaseResult | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const request = useRef<AbortController | null>(null)
  const eligibility = tablebaseEligibility(fen)
  const current = result?.fen === eligibility.fen ? result : null

  useEffect(() => {
    request.current?.abort()
    request.current = null
    setResult(null)
    setError('')
    setRunning(false)
    return () => { request.current?.abort(); request.current = null }
  }, [fen, disabled])

  async function probe() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const next = await probeTablebase(fen, controller.signal)
      if (request.current === controller && !controller.signal.aborted) setResult(next)
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The tablebase request failed.')
    } finally {
      if (request.current === controller) setRunning(false)
    }
  }

  function stop() {
    request.current?.abort()
    request.current = null
    setRunning(false)
  }

  return <section className="tablebase-panel" aria-label="Endgame tablebase">
    <div className="report-caption"><h2>Endgame tablebase</h2></div>
    <p className="engine-empty">Probe the selected position in Lichess’s seven-piece Syzygy tablebases.</p>
    <p className="fine-print">For completed-game analysis. Probing sends only this position’s FEN to tablebase.lichess.ovh.</p>
    {disabled ? <p className="engine-empty">Tablebase lookup is not enabled for this variant.</p> : !eligibility.eligible && <p className="engine-empty">{eligibility.reason}</p>}
    <div className="tablebase-actions">
      <button className="secondary full-width" disabled={disabled || !eligibility.eligible || running} onClick={() => void probe()}>{running ? 'Probing tablebase…' : 'Probe tablebase'}</button>
      {running && <button className="text-button" onClick={stop}>Cancel</button>}
    </div>
    {running && <p className="library-notice" role="status">Looking up the selected position…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {current && <>
      <p className="tablebase-result" role="status"><strong>{current.turn === 'w' ? 'White' : 'Black'} to move: {tablebaseCategoryLabel[current.category]}</strong>{current.checkmate ? ' · Checkmate' : current.stalemate ? ' · Stalemate' : ''}</p>
      <p className="fine-print">Position DTZ50″: {distance(current.dtz, current.preciseDtz)}. Results assume optimal play and use the FEN’s fifty-move counter. Repetition history is unavailable from a FEN.</p>
      {current.moves.length > 0 && <div className="tablebase-table"><table aria-label="Tablebase legal moves"><thead><tr><th scope="col">Move</th><th scope="col">Result for {current.turn === 'w' ? 'White' : 'Black'}</th><th scope="col">DTZ after</th></tr></thead><tbody>{current.moves.map(move => <tr key={move.uci}><td><button className="text-button" disabled={disabled} aria-label={`Try tablebase move ${move.san}`} onClick={() => { if (!disabled && current.fen === tablebaseEligibility(fen).fen) onMove(move.uci) }}>{move.san}</button></td><td>{tablebaseCategoryLabel[move.category]}</td><td>{distance(move.afterDtz, move.afterPreciseDtz)}</td></tr>)}</tbody></table></div>}
      <p className="fine-print">Moves follow the service’s best-first order. DTZ50″ concerns captures or pawn moves and includes fifty-move-rule encoding; it is not a mate distance or a move countdown. Values after a move are from the opponent’s perspective; ≈ means rounded. Cursed wins and blessed losses are draws with the fifty-move rule, despite a theoretical win or loss without it. Uncertain results remain labeled.</p>
    </>}
    <a className="tablebase-source" href="https://github.com/lichess-org/lila-tablebase#http-api" target="_blank" rel="noreferrer">Lichess tablebase documentation</a>
  </section>
}
