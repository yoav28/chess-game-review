import { Clock3 } from 'lucide-react'
import type { Color } from 'chess.js'
import type { ChessPosition } from '../lib/position'
import { formatClock, type GameRecord, type ParsedGame } from '../lib/game'
import type { GameReview } from '../lib/review'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { PlayerAvatar } from './PlayerAvatar'

type PlayerBarProps = {
  color: Color
  game: GameRecord
  parsed: ParsedGame
  ply: number
  review: GameReview | null
  board: ChessPosition
  hideClock?: boolean
}

export function PlayerBar({ color, game, parsed, ply, review, board, hideClock }: PlayerBarProps) {
  const player = color === 'w' ? game.white : game.black
  const profile = usePlayerProfile(player.username)
  const lastClock = parsed.moves
    .slice(0, ply)
    .filter(move => move.color === color)
    .at(-1)?.clockSeconds
  const initialClock = Number(game.timeControl.split('+')[0])
  const material = board.board().flat()
    .filter(piece => piece?.color === color)
    .reduce((sum, piece) => sum + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[piece!.type]), 0)
  const accuracy = color === 'w' ? review?.whiteAccuracy : review?.blackAccuracy
  const checks = board.checksRemaining?.()

  return (
    <div className="player-bar">
      <PlayerAvatar className="player-avatar" color={color} name={player.username} size={40} />
      <div className="player-info">
        <strong>
          {player.username} <span>{player.rating ? `(${player.rating})` : ''}</span>
          {profile?.title && <span className="player-title">{profile.title}</span>}
        </strong>
        <span>
          {color === 'w' ? 'White' : 'Black'}
          {review ? ` · ${accuracy?.toFixed(1) ?? '—'} accuracy` : ` · ${material} material`}
          {checks && ` · ${3 - checks[color]}/3 checks`}
        </span>
      </div>
      <div className={`player-clock player-clock-${color} ${!board.isGameOver() && board.turn() === color ? 'turn' : ''}`}>
        <Clock3 size={20} />
        <span>{hideClock ? '—' : formatClock(lastClock ?? (Number.isFinite(initialClock) && initialClock > 0 ? initialClock : undefined))}</span>
      </div>
    </div>
  )
}
