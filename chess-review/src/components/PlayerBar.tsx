import { Clock3 } from 'lucide-react'
import type { Color } from 'chess.js'
import type { ChessPosition } from '../lib/position'
import { formatClock, type GameRecord, type ParsedGame } from '../lib/game'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { PlayerAvatar } from './PlayerAvatar'
import { CountryFlag } from './CountryFlag'

type PlayerBarProps = {
  color: Color
  game: GameRecord
  parsed: ParsedGame
  ply: number
  board: ChessPosition
  hideClock?: boolean
}

export function PlayerBar({ color, game, parsed, ply, board, hideClock }: PlayerBarProps) {
  const player = color === 'w' ? game.white : game.black
  const profile = usePlayerProfile(player.username)
  const lastClock = parsed.moves
    .slice(0, ply)
    .filter(move => move.color === color)
    .at(-1)?.clockSeconds
  const initialClock = Number(game.timeControl.split('+')[0])
  const headerSide = color === 'w' ? 'White' : 'Black'
  const title = profile?.title ?? parsed.headers[`${headerSide}Title`]
  const country = profile?.country ?? parsed.headers[`${headerSide}Country`]

  return (
    <div className="player-bar">
      <PlayerAvatar className="player-avatar" color={color} name={player.username} size={40} />
      <div className="player-info">
        <strong>
          {title && <span className="player-title">{title}</span>}
          {player.username} <span className="player-rating">{player.rating ? `(${player.rating})` : ''}</span>
          <CountryFlag country={country} />
        </strong>
      </div>
      <div className={`player-clock player-clock-${color} ${!board.isGameOver() && board.turn() === color ? 'turn' : ''}`}>
        <Clock3 size={20} />
        <span>{hideClock ? '—' : formatClock(lastClock ?? (Number.isFinite(initialClock) && initialClock > 0 ? initialClock : undefined))}</span>
      </div>
    </div>
  )
}
