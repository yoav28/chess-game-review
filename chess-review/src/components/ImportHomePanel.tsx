import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Circle, Upload } from 'lucide-react'
import type { useLibrary } from '../hooks/useLibrary'
import { loadSavedReviews, type SavedReview } from '../lib/storage'
import type { GameRecord } from '../lib/game'
import './ImportHomePanel.css'

type ImportSource = 'chess.com' | 'lichess' | 'pgn'

const importSources: { key: ImportSource; label: string }[] = [
  { key: 'chess.com', label: 'Chess.com' },
  { key: 'lichess', label: 'Lichess' },
  { key: 'pgn', label: 'PGN' },
]

function ChessComIcon() {
  return <svg aria-hidden="true" className="chesscom-import-icon" viewBox="0 0 290 400"><path fill="#5d9948" d="M225 273.7c-55.7-42.6-49.5-79.5-50.2-94.7h34c4-7.4 6-14.2 6-22.8l-38.5-25.4c13.4-9.7 22.1-25.5 22.1-43.3 0-22.4-13.8-41.7-33.4-49.6-6.2-2.5-49.8 141.1-49.8 141.1-.2 3.3-.2 7.6-.2 12.8 0 14.3 35 12.1 33.1 24.7-2.8 18.8-3.4 33.2-19.6 78.4-10.9 30.6-83.8 0-89 15-3.6 10.4-5.5 22.1-5.5 34.7 0 1.3 2.9 21.5 111 21.5s111-20.2 111-21.5c0-30.7-11.4-56-31-70.9z"/><path fill="#81b64c" d="M143 292.8c6-27.4 11.3-56.6 14.6-74.1 4-21.8-29-25.7-42.6-27.7-.6 18.6-5.8 48.9-50.1 82.7-11.9 9.1-20.8 22.1-26 37.9 12 5.8 27.9 9.3 52.5 9.3 15.8 0 45 1.9 51.6-28.1zm23.2-113.9c5.2-13.6 4.6-22.8 4.6-22.8L149 130.7c23.2-9.9 37.2-28.6 37.2-50.3 0-17.3-8.3-32.8-21-42.5-6.2-2.5-13-4-20.1-4-29.5 0-53.4 23.9-53.4 53.5 0 17.8 8.7 33.6 22.1 43.3l-38.5 25.4c0 8.5 2 15.4 6 22.8h84.9z"/><path fill="#b2e068" d="M142 44.9c30.8 4.8-14.2 40.6-28.4 38.9-13.5-1.7-.5-43.4 28.4-38.9z"/></svg>
}

function PgnIcon() {
  return <svg aria-hidden="true" height="18" width="18" viewBox="0 0 18 18"><path fill="currentColor" d="M1 1h5v5H1zm5 5h5v5H6zm5-5h5v5h-5zm0 10h5v5h-5zm-10 0h5v5H1zm10-5h5v5h-5z"/></svg>
}

export function ImportHomePanel({
  library,
  onOpenReview,
  onSelectGame,
  onLoadPgn,
}: {
  library: ReturnType<typeof useLibrary>
  onOpenReview: (entry: SavedReview) => void
  onSelectGame: (game: GameRecord) => void
  onLoadPgn: (pgn: string) => string
}) {
  const [source, setSource] = useState<ImportSource>('chess.com')
  const [username, setUsername] = useState(library.username)
  const [pgn, setPgn] = useState('')
  const [recent, setRecent] = useState<SavedReview[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => setUsername(library.username), [library.username])
  useEffect(() => {
    let active = true
    void loadSavedReviews().then(entries => {
      if (active) setRecent(entries.sort((a, b) => Date.parse(b.review.analyzedAt) - Date.parse(a.review.analyzedAt)).slice(0, 5))
    }).catch(() => { if (active) setRecent([]) })
    return () => { active = false }
  }, [])

  async function importUser(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (source === 'chess.com') {
      await library.importUser(username)
      return
    }
    if (source === 'lichess') {
      setLoading(true)
      try {
        const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=100`, {
          headers: { Accept: 'application/x-ndjson' },
        })
        if (!response.ok) throw new Error(`Lichess could not load games for ${username}.`)
        const games = await response.text()
        if (!games.trim()) throw new Error(`No public games were found for ${username}.`)
        await library.importPgn(username, games)
      } catch (cause) {
        setError((cause as Error).message)
      } finally {
        setLoading(false)
      }
    }
  }

  function loadPgn() {
    const message = onLoadPgn(pgn)
    setError(message)
    if (!message) setPgn('')
  }

  function loadFile(text: string) {
    const message = onLoadPgn(text)
    setError(message)
    if (!message) setPgn('')
  }

  return (
    <div className="import-home">
      <div className="import-home-tabs" role="tablist" aria-label="Import a game from">
        {importSources.map(({ key, label }) => <button
          key={key}
          type="button"
          role="tab"
          id={`import-home-${key}`}
          aria-selected={source === key}
          aria-controls="import-home-panel"
          onClick={() => { setSource(key); setError('') }}
        >{key === 'chess.com' ? <ChessComIcon /> : key === 'lichess' ? <Circle size={20} /> : <PgnIcon />}<span>{label}</span></button>)}
      </div>
      <div className="import-home-panel" id="import-home-panel" role="tabpanel" aria-labelledby={`import-home-${source}`}>
        {source === 'pgn' ? <>
          <label htmlFor="home-pgn">PGN game or FEN position</label>
          <textarea id="home-pgn" value={pgn} onChange={event => setPgn(event.target.value)} placeholder={'[White "Player"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6…'} />
          <input ref={file} type="file" accept=".pgn,.txt,.fen" hidden onChange={async event => {
            const selected = event.target.files?.[0]
            if (selected) loadFile(await selected.text())
            event.target.value = ''
          }} />
          <div className="import-home-actions">
            <button className="secondary" type="button" onClick={() => file.current?.click()}><Upload size={15} /> Choose file</button>
            <button className="primary" type="button" disabled={!pgn.trim()} onClick={loadPgn}>Load game</button>
          </div>
        </> : <form onSubmit={importUser}>
          <label htmlFor="home-username">{source === 'chess.com' ? 'Chess.com username' : 'Lichess username'}</label>
          <input id="home-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Enter username" autoComplete="off" spellCheck={false} required />
          <button className="primary import-home-find" disabled={library.loading || loading}>{loading ? 'Finding games…' : 'Find Games'}</button>
        </form>}
        {(error || library.error) && <p className="error-message" role="alert">{error || library.error}</p>}
        {library.notice && <p className="fine-print" role="status">{library.notice}</p>}
        {library.loading && <div className="import-home-progress">
          <span role="status">{library.progress?.archivesTotal ? `${library.progress.archivesCompleted} / ${library.progress.archivesTotal} months` : 'Finding archives…'}</span>
          <progress aria-label="Archive import progress" max={library.progress?.archivesTotal || 1} value={library.progress?.archivesCompleted || 0} />
          <span>{library.progress?.gamesLoaded.toLocaleString() ?? 0} games loaded</span>
          <button className="secondary" type="button" onClick={library.cancel}>Stop import</button>
        </div>}
      </div>
      {recent.length > 0 || library.games.length > 0 ? <section className="recent-reviews" aria-label="Recent reviews">
        <h2>Recent Reviews</h2>
        {recent.length > 0 ? recent.map(entry => <div className="recent-review-row" key={entry.id}>
          <button className="recent-review-link" type="button" onClick={() => onOpenReview(entry)}>
            <span>{entry.review.white} vs. {entry.review.black}</span>
            <span>{new Date(entry.review.analyzedAt).toLocaleDateString()} · Reviewed</span>
          </button>
        </div>) : library.games.slice(0, 5).map(game => <div className="recent-review-row" key={game.id}>
          <button className="recent-review-link" type="button" onClick={() => onSelectGame(game)}>
            <span>{game.white.username} vs. {game.black.username}</span>
            <span>{game.endTime ? new Date(game.endTime * 1000).toLocaleDateString() : 'Imported'} · Ready to review</span>
          </button>
        </div>)}
        <p className="recent-review-note">Saved in this browser. Up to 100 recent games.</p>
      </section> : null}
    </div>
  )
}
