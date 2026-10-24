import { useMemo } from 'react'
import type { GameReview } from '../lib/review'
import type { GameRecord } from '../lib/game'
import { openingHistory } from '../lib/opening-history'
import { classificationLabels } from '../lib/review'
import './ReviewOverview.css'

export function ReviewOverview({ review, games, username, onSelect, onExploreOpening }: { review: GameReview; games: readonly GameRecord[]; username: string; onSelect: (ply: number) => void; onExploreOpening: (ply: number) => void }) {
  const localOpening = useMemo(() => review.opening ? openingHistory(games, review.opening.eco, username) : null, [games, review.opening, username])
  const result = review.result === '1-0' ? `${review.white} won.` : review.result === '0-1' ? `${review.black} won.` : review.result === '1/2-1/2' ? 'The game was drawn.' : 'The recorded game is unfinished.'
  const errors = review.moves.filter(move => ['mistake', 'blunder', 'missed'].includes(move.classification))
  const loss = (move: GameReview['moves'][number]) => review.accuracyVersion === 2 ? move.winningChanceLoss ?? 0 : move.centipawnLoss
  const critical = review.moves.reduce<GameReview['moves'][number] | undefined>((largest, move) => loss(move) > (largest ? loss(largest) : 0) ? move : largest, undefined)
  const book = review.moves.filter(move => move.bookName)
  const lastBook = book.at(-1)
  const label = (move: GameReview['moves'][number]) => `${move.beforeFen.split(' ')[5]}${move.color === 'w' ? '.' : '…'} ${move.san}`
  return <details className="review-overview">
    <summary>Game summary & opening</summary>
    <p>{result} {review.moves.length} half-moves reviewed. {errors.length} {errors.length === 1 ? 'move was' : 'moves were'} classified as a mistake, blunder, or missed opportunity.</p>
    {critical && <p>Largest recorded loss: <button className="text-button" onClick={() => onSelect(critical.ply)}>{label(critical)} · {classificationLabels[critical.classification]}</button>{' '}({review.accuracyVersion === 2 ? `${loss(critical).toFixed(1)} ${review.variant === 'threecheck' ? 'heuristic points' : 'winning-chance points'}` : `legacy loss score ${Math.round(loss(critical))}; review again for the current metric`}).</p>}
    {review.opening && <p><strong>{review.opening.name}</strong> · {review.opening.eco}</p>}
    {review.opening && localOpening?.games ? <p>In your local library, you have {localOpening.games} games with ECO {review.opening.eco}: {localOpening.wins} wins, {localOpening.draws} draws, and {localOpening.losses} losses. ECO codes can include multiple named variations.</p> : null}
    {review.opening && <button className="text-button" onClick={() => onExploreOpening(lastBook?.ply ?? 0)}>Explore this opening in your library</button>}
    {lastBook ? <>
      <p>Last book position recorded in this report: <button className="text-button" onClick={() => onSelect(lastBook.ply)}>{label(lastBook)}</button>.</p>
      <div className="opening-replay" aria-label="Recorded opening moves">{book.map(move => <button className="text-button" key={move.ply} onClick={() => onSelect(move.ply)}>{label(move)}</button>)}</div>
    </> : <p>{review.variant === 'threecheck' ? 'Three-check has its own win condition; the standard opening book does not apply.' : review.variant === 'chess960' ? 'Chess960 starts from a shuffled position; the standard opening book does not apply.' : 'No local book prefix was identified for this recorded starting position and move order.'}</p>}
    <p className="fine-print">This summary uses the recorded result and this report’s engine estimates and book labels. New reviews use the local Lichess-derived opening registry.</p>
  </details>
}
