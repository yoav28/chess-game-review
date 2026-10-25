import { Clock3 } from 'lucide-react'
import type { Color } from 'chess.js'
import type { ChessPosition } from '../lib/position'
import { formatClock, type GameRecord, type ParsedGame } from '../lib/game'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { PlayerAvatar } from './PlayerAvatar'
import { CountryFlag } from './CountryFlag'
import { Piece } from './ChessPiece'
import { useBoardAppearance } from './BoardAppearanceContext'

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
  const { appearance } = useBoardAppearance()
  const lastClock = parsed.moves
    .slice(0, ply)
    .filter(move => move.color === color)
    .at(-1)?.clockSeconds
  const initialClock = Number(game.timeControl.split('+')[0])
  const headerSide = color === 'w' ? 'White' : 'Black'
  const title = profile?.title ?? parsed.headers[`${headerSide}Title`]
  const country = profile?.country ?? parsed.headers[`${headerSide}Country`]
  const captured = parsed.moves.slice(0, ply).reduce<Partial<Record<'p' | 'n' | 'b' | 'r' | 'q', number>>>((pieces, move) => {
    if (move.color === color && move.captured && move.captured !== 'k') {
      pieces[move.captured] = (pieces[move.captured] ?? 0) + 1
    }
    return pieces
  }, {})
  const material = (side: Color) => board.board().flat()
    .filter(piece => piece?.color === side)
    .reduce((sum, piece) => sum + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[piece!.type]), 0)
  const materialDifference = material(color) - material(color === 'w' ? 'b' : 'w')

  return (
    <div className="player-bar">
      <PlayerAvatar className="player-avatar" color={color} name={player.username} size={40} />
      <div className="player-info">
        <strong>
          {title && <span className="player-title">{title}</span>}
          {player.username} <span className="player-rating">{player.rating ? `(${player.rating})` : ''}</span>
          <CountryFlag country={country} />
        </strong>
        <div className="player-captures" aria-label={`${color === 'w' ? 'White' : 'Black'} captured material`}>
          {(['q', 'r', 'b', 'n', 'p'] as const).map(type => Array.from({ length: captured[type] ?? 0 }, (_, index) => (
            <span className="player-captured-piece" key={`${type}-${index}`}><Piece type={type} color={color === 'w' ? 'b' : 'w'} set={appearance.pieceSet} /></span>
          )))}
          {materialDifference > 0 && <span className="player-material">+{materialDifference}</span>}
        </div>
      </div>
      <div className={`player-clock player-clock-${color} ${!board.isGameOver() && board.turn() === color ? 'turn' : ''}`}>
        <Clock3 size={20} />
        <span>{hideClock ? '—' : formatClock(lastClock ?? (Number.isFinite(initialClock) && initialClock > 0 ? initialClock : undefined))}</span>
      </div>
    </div>
  )
}
