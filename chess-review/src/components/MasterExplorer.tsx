import { useEffect, useRef, useState } from 'react'
import { exploreMasterGames, masterExplorerEligibility, masterExplorerSource, type MasterExplorerResult } from '../lib/master-explorer'
import type { ChessVariant } from '../lib/position'
import './MasterExplorer.css'

export function MasterExplorer({ fen, variant = 'chess', onMove }: { fen: string; variant?: ChessVariant; onMove: (uci: string) => void }) {
  const eligibility = masterExplorerEligibility(fen, variant)
  const [result, setResult] = useState<MasterExplorerResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [stopped, setStopped] = useState(false)
  const request = useRef<AbortController | null>(null)
  const current = result?.fen === eligibility.fen ? result : null

  useEffect(() => {
    request.current?.abort()
    request.current = null
    setResult(null)
    setRunning(false)
    setError('')
    setStopped(false)
    return () => { request.current?.abort(); request.current = null }
  }, [fen, variant])

  async function load() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setRunning(true)
    setResult(null)
    setError('')
    setStopped(false)
    try {
      const next = await exploreMasterGames(fen, { variant, signal: controller.signal })
      if (request.current === controller && !controller.signal.aborted) setResult(next)
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The masters lookup failed.')
    } finally {
      if (request.current === controller) setRunning(false)
    }
  }

  function stop() {
    request.current?.abort()
    request.current = null
    setRunning(false)
    setStopped(true)
  }

  return <section className="master-explorer" aria-label="Lichess masters opening explorer">
    <div className="report-caption"><h2>Masters database</h2></div>
    <p className="engine-empty">Optional online lookup. Load sends this position’s FEN to Lichess. The imported-game explorer searches your library locally.</p>
    {!eligibility.eligible && <p className="library-notice">{eligibility.reason}</p>}
    {running ? <div className="master-explorer-loading" role="status"><span>Loading master games…</span><button className="text-button" onClick={stop}>Stop</button></div> : <button className="secondary full-width" disabled={!eligibility.eligible} onClick={() => void load()}>{current ? 'Load masters again' : 'Load masters'}</button>}
    {stopped && <p className="library-notice" role="status">Masters lookup stopped.</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {current && <>
      <p className="master-explorer-total" role="status">{current.games.toLocaleString()} master games</p>
      <p className="fine-print">White wins {current.whiteWins.toLocaleString()} · Draws {current.draws.toLocaleString()} · Black wins {current.blackWins.toLocaleString()}</p>
      {current.moves.length > 0 ? <div className="master-explorer-table"><table aria-label="Master-game continuations"><thead><tr><th scope="col">Move</th><th scope="col">Games</th><th scope="col" title="White wins / draws / Black wins">W / D / B</th><th scope="col">Avg Elo</th></tr></thead><tbody>{current.moves.map(move => <tr key={move.uci}><td><button className="text-button" onClick={() => onMove(move.uci)} aria-label={`Play master continuation ${move.san}`}>{move.san}</button></td><td>{move.games.toLocaleString()}</td><td>{move.whiteWins.toLocaleString()} / {move.draws.toLocaleString()} / {move.blackWins.toLocaleString()}</td><td>{move.averageRating || '—'}</td></tr>)}</tbody></table></div> : <p className="engine-empty">No master-game continuations were returned for this position.</p>}
      {current.topGames.length > 0 && <section className="master-explorer-examples"><h3>Example games</h3><ul>{current.topGames.map(game => <li key={game.id}><span>{game.white.name}{game.white.rating > 0 && ` (${game.white.rating})`} — {game.black.name}{game.black.rating > 0 && ` (${game.black.rating})`}</span><span>{game.year} · {game.san} · {game.winner === 'white' ? '1–0' : game.winner === 'black' ? '0–1' : '½–½'} <a href={game.pgnUrl} target="_blank" rel="noreferrer">PGN ↗</a></span></li>)}</ul></section>}
      <p className="fine-print">Up to 12 continuations and 5 example games. Counts describe games in Lichess’s masters database, not engine evaluations. Results are cached in this browser session for 10 minutes.</p>
    </>}
    <a className="master-explorer-source" href={masterExplorerSource} target="_blank" rel="noreferrer">Lichess opening explorer API ↗</a>
  </section>
}
