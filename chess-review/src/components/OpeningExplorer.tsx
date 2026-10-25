import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { exploreImportedGames, type ExplorerProgress, type ExplorerResult } from '../lib/explorer'
import type { GameRecord } from '../lib/game'
import type { ChessVariant } from '../lib/position'

const cell: CSSProperties = { padding: '10px 3px', textAlign: 'right', borderBottom: '1px solid var(--border)' }
const heading: CSSProperties = { ...cell, fontWeight: 500, color: 'var(--muted)' }

type Props = { games: GameRecord[]; fen: string; variant?: ChessVariant; onMove: (uci: string) => void }

export function OpeningExplorer({ games, fen, variant = 'chess', onMove }: Props) {
  const [result, setResult] = useState<ExplorerResult | null>(null)
  const [progress, setProgress] = useState<ExplorerProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [stopped, setStopped] = useState(false)
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    request.current?.abort()
    request.current = null
    setResult(null)
    setProgress(null)
    setRunning(false)
    setError('')
    setStopped(false)
    return () => { request.current?.abort(); request.current = null }
  }, [games, fen, variant])

  async function explore() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setRunning(true)
    setResult(null)
    setProgress(null)
    setError('')
    setStopped(false)
    try {
      const next = await exploreImportedGames(games, fen, {
        signal: controller.signal,
        variant,
        onProgress: value => { if (request.current === controller && !controller.signal.aborted) setProgress(value) },
      })
      if (request.current === controller && !controller.signal.aborted) setResult(next)
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'These games could not be explored.')
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

  return <section className="opening-explorer" aria-label="Imported game explorer">
    <div className="report-caption"><h2>Opening explorer</h2></div>
    <p className="engine-empty">Search this position in all {games.length.toLocaleString()} imported games. Results come from this library.</p>
    {running ? <div className="import-status" role="status"><div><span>{progress?.scanned.toLocaleString() ?? 0} / {games.length.toLocaleString()} games checked</span><button className="text-button" onClick={stop}>Stop</button></div><progress max={games.length || 1} value={progress?.scanned ?? 0} /></div> : <button className="secondary full-width" disabled={!games.length} onClick={() => void explore()}>{result ? 'Explore again' : 'Explore imported games'}</button>}
    {!games.length && <p className="engine-empty">Import a username’s games to explore its history.</p>}
    {stopped && <p className="library-notice" role="status">Search stopped. Run it again to get complete results.</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {result && <>
      <p className="library-notice" role="status">{result.matchingGames.toLocaleString()} matching games · {result.standardGames.toLocaleString()} {variant === 'threecheck' ? 'valid three-check games checked' : variant === 'chess960' ? 'valid Chess960 games checked' : variant === 'kingofthehill' ? 'valid King of the Hill games checked' : variant === 'atomic' ? 'valid Atomic games checked' : 'valid games using standard chess moves checked'}.{result.skippedGames > 0 && ` ${result.skippedGames.toLocaleString()} other-variant or invalid games skipped.`}{result.duplicateGames > 0 && ` ${result.duplicateGames.toLocaleString()} duplicates excluded.`}</p>
      {result.moves.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }} aria-label="Moves played in imported games"><thead><tr><th scope="col" style={{ ...heading, textAlign: 'left' }}>Move</th><th scope="col" style={heading}>Games</th><th scope="col" style={heading} title="White wins / draws / Black wins">W / D / B</th><th scope="col" style={heading} title="Average of all known player ratings in these games">Avg Elo</th></tr></thead><tbody>{result.moves.map(move => <tr key={move.uci}><td style={{ ...cell, textAlign: 'left' }}><button className="text-button" onClick={() => onMove(move.uci)} aria-label={`Play ${move.san}`}>{move.san}</button></td><td style={cell}>{move.games.toLocaleString()}</td><td style={cell}>{move.whiteWins} / {move.draws} / {move.blackWins}{move.unknownResults > 0 && <span title="Games without a known result"> · {move.unknownResults} ?</span>}</td><td style={cell}>{move.averageRating ?? '—'}</td></tr>)}</tbody></table></div> : <p className="engine-empty">No continuations were recorded from this position.</p>}
      <p className="fine-print" style={{ marginTop: 12 }}>Results show White wins, draws, and Black wins. Each game counts once per distinct next move, including transpositions. Unfinished results are marked ?. Ratings average known players.</p>
    </>}
  </section>
}
