import type { Chess, Color } from 'chess.js'
import { formatClock, type GameRecord, type ParsedGame } from '../lib/game'
import type { GameReview } from '../lib/review'

type PlayerBarProps = {
  color: Color
  game: GameRecord
  parsed: ParsedGame
  ply: number
  review: GameReview | null
  board: Chess
  hideClock?: boolean
}

export function PlayerBar({ color, game, parsed, ply, review, board, hideClock }: PlayerBarProps) {
  const player = color === 'w' ? game.white : game.black
  const lastClock = parsed.moves
    .slice(0, ply)
    .filter(move => move.color === color)
    .at(-1)?.clockSeconds
  const initialClock = Number(game.timeControl.split('+')[0])
  const material = board.board().flat()
    .filter(piece => piece?.color === color)
    .reduce((sum, piece) => sum + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[piece!.type]), 0)
  const accuracy = color === 'w' ? review?.whiteAccuracy : review?.blackAccuracy

  return (
    <div className="player-bar">
      <div className={`player-avatar ${color}`} aria-hidden="true">
        {color === 'w' ? '♔' : '♚'}
      </div>
      <div className="player-info">
        <strong>
          {player.username} <span>{player.rating ? `(${player.rating})` : ''}</span>
        </strong>
        <span>
          {color === 'w' ? 'White' : 'Black'}
          {review ? ` · ${accuracy?.toFixed(1) ?? '—'} accuracy` : ` · ${material} material`}
        </span>
      </div>
      <div className={`player-clock ${board.turn() === color ? 'turn' : ''}`}>
        {hideClock ? '—' : formatClock(lastClock ?? (Number.isFinite(initialClock) && initialClock > 0 ? initialClock : undefined))}
      </div>
    </div>
  )
}
