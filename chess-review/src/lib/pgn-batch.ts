import { gameFromPgn, type GameRecord } from './game'

const maxBytes = 25 * 1024 * 1024
const maxGames = 5000

export function gamesFromPgnFile(text: string): GameRecord[] {
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('PGN files must be 25 MB or smaller.')
  const source = text.replace(/^\uFEFF/, '').trim()
  if (!source) throw new Error('The PGN file is empty.')
  const chunks = source.split(/(?=^\[Event\s+")/m).map(game => game.trim()).filter(Boolean)
  if (chunks.length > maxGames) throw new Error(`PGN files can contain up to ${maxGames.toLocaleString()} games.`)
  const games: GameRecord[] = []
  const failures: string[] = []
  chunks.forEach((pgn, index) => {
    try { games.push(gameFromPgn(pgn)) }
    catch (error) { failures.push(`Game ${index + 1}: ${(error as Error).message}`) }
  })
  if (failures.length) throw new Error(`${failures.length} of ${chunks.length} games could not be imported. ${failures.slice(0, 3).join(' ')}`)
  return games
}
