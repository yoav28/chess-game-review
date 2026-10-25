import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Circle, Crown, FileText, Upload } from 'lucide-react'
import type { useLibrary } from '../hooks/useLibrary'
import { loadSavedReviews, type SavedReview } from '../lib/storage'
import type { GameRecord } from '../lib/game'
import './ImportHomePanel.css'

type ImportSource = 'chess.com' | 'lichess' | 'pgn'

const importSources: { key: ImportSource; label: string; Icon: typeof Crown }[] = [
  { key: 'chess.com', label: 'Chess.com', Icon: Crown },
  { key: 'lichess', label: 'Lichess', Icon: Circle },
  { key: 'pgn', label: 'PGN', Icon: FileText },
]

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
        {importSources.map(({ key, label, Icon }) => <button
          key={key}
          type="button"
          role="tab"
          id={`import-home-${key}`}
          aria-selected={source === key}
          aria-controls="import-home-panel"
          onClick={() => { setSource(key); setError('') }}
        ><Icon size={20} /><span>{label}</span></button>)}
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
          <p className="fine-print">{source === 'chess.com' ? 'Public Chess.com archive games. No login needed.' : 'Public Lichess games. No login needed.'}</p>
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
