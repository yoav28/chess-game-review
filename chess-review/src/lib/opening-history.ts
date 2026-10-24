import type { GameRecord } from './game'

export type OpeningHistory = { games: number; wins: number; draws: number; losses: number }

const drawn = new Set(['draw', 'agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])
const unfinished = new Set(['unknown', 'unfinished', 'abandoned', '*', ''])

function ecoCode(game: GameRecord): string | null {
  const pgnCode = game.pgn.match(/^\[ECO\s+"([A-E]\d{2})"\]/im)?.[1]
  return (pgnCode ?? game.eco?.match(/\b([A-E]\d{2})\b/i)?.[1])?.toUpperCase() ?? null
}

export function openingHistory(games: readonly GameRecord[], eco: string, username: string): OpeningHistory {
  const player = username.trim().toLowerCase()
  const result: OpeningHistory = { games: 0, wins: 0, draws: 0, losses: 0 }
  if (!player) return result
  for (const game of games) {
    if (ecoCode(game) !== eco) continue
    const side = game.white.username.trim().toLowerCase() === player ? game.white
      : game.black.username.trim().toLowerCase() === player ? game.black : null
    if (!side) continue
    result.games += 1
    const outcome = side.result.toLowerCase()
    if (outcome === 'win') result.wins += 1
    else if (drawn.has(outcome)) result.draws += 1
    else if (!unfinished.has(outcome)) result.losses += 1
  }
  return result
}
