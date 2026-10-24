import { useEffect, useId, useMemo, useState } from 'react'
import { accuracyModelLabel, historyMethod, playerHistory, playersInHistory, reviewAccuracyVersion, reviewDate, reviewVariant, sortedSavedReviews, variantsForPlayer, type HistoryScore } from '../lib/history'
import { variantLabel, type ChessVariant } from '../lib/variants'
import { loadSavedReviews, type SavedReview } from '../lib/storage'
import './SavedReviewsPanel.css'

const accuracyText = (score: HistoryScore) => score.accuracy === null ? '—' : `${score.accuracy.toFixed(1)}%`

function dateText(entry: SavedReview): string {
  const date = reviewDate(entry.review)
  if (date.timestamp === null) return 'Date unavailable'
  const text = new Date(date.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return date.source === 'review' ? `Reviewed ${text}` : text
}

export function SavedReviewsPanel({ onOpen, refreshKey }: { onOpen: (entry: SavedReview) => void; refreshKey?: string }) {
  const [entries, setEntries] = useState<SavedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [player, setPlayer] = useState('')
  const [pool, setPool] = useState<ChessVariant>('chess')
  const [limit, setLimit] = useState(30)
  const searchId = useId()
  const playerId = useId()
  const rulesId = useId()
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void loadSavedReviews().then(result => {
      if (active) setEntries(sortedSavedReviews(result))
    }).catch(() => {
      if (active) setError('Saved reviews could not be loaded. Check browser storage access and try again.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey, reload])
  const players = useMemo(() => playersInHistory(entries), [entries])
  const query = search.trim().toLocaleLowerCase()
  const availablePlayers = players.filter(name => name.toLocaleLowerCase().includes(query))
  const selectedPlayer = players.includes(player) ? player : ''
  const pools = useMemo(() => variantsForPlayer(entries, selectedPlayer), [entries, selectedPlayer])
  const selectedPool = pools.includes(pool) ? pool : pools[0] ?? 'chess'
  const summary = useMemo(() => selectedPlayer ? playerHistory(entries, selectedPlayer, selectedPool) : null, [entries, selectedPlayer, selectedPool])
  const visible = useMemo(() => entries.filter(({ review }) => [review.white, review.black].some(name => name.toLocaleLowerCase().includes(query))), [entries, query])
  return <section className="saved-reviews" aria-label="Saved reviews">
    <div className="report-caption"><h2>Saved reviews</h2><button className="text-button" disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button></div>
    <p className="saved-history-note">Reviews saved in this browser. Open one to continue analysis or practice.</p>
    {loading && <p className="saved-status" role="status">Loading saved reviews…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {entries.length > 0 && <>
      <label htmlFor={searchId}>Search saved player</label>
      <input id={searchId} type="search" value={search} placeholder="Player name" autoComplete="off" onChange={event => { setSearch(event.target.value); setLimit(30) }} />
      <label htmlFor={playerId}>Player statistics</label>
      <select id={playerId} value={selectedPlayer} onChange={event => setPlayer(event.target.value)}>
        <option value="">Choose a player</option>
        {[...new Set([...availablePlayers, ...(selectedPlayer ? [selectedPlayer] : [])])].map(name => <option key={name} value={name}>{name}</option>)}
      </select>
      {selectedPlayer && <><label htmlFor={rulesId}>Statistics rules</label><select id={rulesId} value={selectedPool} onChange={event => setPool(event.target.value as ChessVariant)}>{pools.map(variant => <option key={variant} value={variant}>{variantLabel(variant)}</option>)}</select><p className="saved-history-note">Statistics use one rules pool. Three-check quality scores are a heuristic, not calibrated winning probabilities.</p></>}
      {summary && <section className="saved-player-summary" aria-label={`${summary.player} saved review statistics`}>
        <h3>{summary.player}</h3>
        <p>Statistics use {summary.modelLabel}.{summary.excludedReviews > 0 ? ` ${summary.excludedReviews} older-model ${summary.excludedReviews === 1 ? 'review is' : 'reviews are'} excluded from these statistics and ${summary.excludedReviews === 1 ? 'remains' : 'remain'} available below.` : ' All statistics below use this model.'}</p>
        {summary.excludedDuplicates > 0 && <p>{summary.excludedDuplicates} duplicate {summary.excludedDuplicates === 1 ? 'report is' : 'reports are'} omitted from statistics. All saved copies remain available below.</p>}
        <p>{summary.games} reviewed games · {summary.wins} wins · {summary.draws} draws · {summary.losses} losses{summary.unfinished ? ` · ${summary.unfinished} other results` : ''}</p>
        <dl>
          {[{ label: 'Overall move accuracy', score: summary.overall }, ...summary.categories].map(category => <div key={category.label}>
            <dt>{category.label}</dt><dd>{accuracyText(category.score)} <span>{category.score.moves} moves · {category.score.games} games</span></dd>
          </div>)}
        </dl>
        {summary.controls.length > 0 && <><h4>By time group</h4><dl>{summary.controls.map(category => <div key={category.label}><dt>{category.label}</dt><dd>{accuracyText(category.score)} <span>{category.score.moves} moves · {category.score.games} games</span></dd></div>)}</dl></>}
        {summary.trend ? <p className="saved-trend">Recent {summary.trend.recent.games} games: {accuracyText(summary.trend.recent)} ({summary.trend.recent.moves} moves). Previous {summary.trend.earlier.games}: {accuracyText(summary.trend.earlier)} ({summary.trend.earlier.moves} moves). Change: {summary.trend.delta > 0 ? '+' : ''}{summary.trend.delta.toFixed(1)} percentage points.</p>
          : <p className="saved-history-note">A trend needs at least four scored games with valid, distinguishable game dates.</p>}
      </section>}
      <p className="saved-list-count">{visible.length} saved {visible.length === 1 ? 'review' : 'reviews'} · newest first</p>
      <ul className="saved-review-list">{visible.slice(0, limit).map(entry => <li key={entry.id}>
        <button onClick={() => onOpen(entry)}>
          <strong>{entry.review.white} <span>vs</span> {entry.review.black}</strong>
          <span>{entry.review.result} · {dateText(entry)}</span>
          <span>Accuracy · White {entry.review.whiteAccuracy?.toFixed(1) ?? '—'} · Black {entry.review.blackAccuracy?.toFixed(1) ?? '—'}</span>
          <span>{accuracyModelLabel(reviewAccuracyVersion(entry.review), reviewVariant(entry.review))}{entry.review.variant === 'chess960' ? ' · Chess960' : ''}</span>
          {entry.review.importedAt && <span>Imported review file</span>}
        </button>
      </li>)}</ul>
      {!visible.length && <p className="saved-status">No saved reviews match this player.</p>}
      {visible.length > limit && <button className="secondary full-width" onClick={() => setLimit(value => value + 30)}>Show more reviews</button>}
      <details className="saved-history-method"><summary>How statistics work</summary><p>{historyMethod}</p></details>
    </>}
    {!loading && !error && !entries.length && <p className="saved-status">No saved reviews yet. Complete a game review to keep it here.</p>}
  </section>
}
