import { Chess } from 'chess.js'
import type { ParsedGame } from './game'
import { createPosition } from './position'

const initialPosition = new Chess().fen()

export function parseMoveTimeControl(value: string): { initialSeconds: number; incrementSeconds: number } | null {
  const match = /^(\d+)(?:\+(\d+))?$/.exec(value)
  if (!match) return null
  const initialSeconds = Number(match[1])
  const incrementSeconds = Number(match[2] ?? 0)
  if (!Number.isSafeInteger(initialSeconds) || !Number.isSafeInteger(incrementSeconds) || !Number.isSafeInteger(initialSeconds + incrementSeconds) || initialSeconds + incrementSeconds <= 0) return null
  return { initialSeconds, incrementSeconds }
}

export function moveTimes(parsed: ParsedGame, timeControl = parsed.headers.TimeControl ?? '', timeClass = ''): (number | null)[] {
  const control = parseMoveTimeControl(timeControl)
  if (!control || timeClass.toLowerCase() === 'daily') return parsed.moves.map(() => null)
  const fields = parsed.initialFen.split(' ')
  const pieces = createPosition(parsed.initialFen, parsed.variant).board().flat().filter(piece => piece !== null)
  const starting960 = parsed.variant === 'chess960' && fields[1] === 'w' && fields[4] === '0' && fields[5] === '1' && pieces.length === 32
    && pieces.every(piece => piece.type === 'p' ? piece.square[1] === (piece.color === 'w' ? '2' : '7') : piece.square[1] === (piece.color === 'w' ? '1' : '8'))
  const initialClock = parsed.initialFen === initialPosition || starting960 ? control.initialSeconds : null
  const previous: Record<'w' | 'b', number | null> = { w: initialClock, b: initialClock }
  return parsed.moves.map(move => {
    const clock = move.clockSeconds
    const before = previous[move.color]
    if (clock === undefined || !Number.isFinite(clock) || clock < 0) {
      previous[move.color] = null
      return null
    }
    previous[move.color] = clock
    if (before === null) return null
    const elapsed = before + control.incrementSeconds - clock
    return Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed * 1000) / 1000 : null
  })
}
