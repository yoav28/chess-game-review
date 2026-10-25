import { Chess } from 'chess.js'
import { makeFen } from 'chessops/fen'
import { Antichess, Crazyhouse, Horde, RacingKings } from 'chessops/variant'
import { ChessopsBoard } from './chessops-board'
import type { GameMove, ParsedGame } from './game'
import { pgnVariant, threeCheckInitialFen, variantLabel } from './variants'

function clock(comment: string): number | undefined {
  const match = comment.match(/\[%clk\s+(\d+(?::\d+){0,2}(?:\.\d+)?)\s*\]/i)
  if (!match) return undefined
  const parts = match[1].split(':').map(Number)
  if (parts.some(value => !Number.isFinite(value) || value < 0) || parts.slice(1).some(value => value >= 60)) return undefined
  return parts.reduce((seconds, value) => seconds * 60 + value, 0)
}

export function parseVariantPgn(pgn: string, variant: 'chess960' | 'threecheck' | 'kingofthehill' | 'atomic' | 'horde' | 'crazyhouse' | 'giveaway' | 'racingkings'): ParsedGame {
  const name = variantLabel(variant)
  if (!pgn.trim()) throw new Error(`The ${name} PGN is empty.`)
  const source = pgn.replace(/^\uFEFF/, '')
  const headers = Object.fromEntries([...source.matchAll(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)].map(match => [match[1], match[2].replace(/\\(["\\])/g, '$1')]))
  if (headers.Variant) {
    try { if (pgnVariant(pgn) !== variant) throw new Error('Variant mismatch.') }
    catch { throw new Error(`This PGN does not identify a ${name} game.`) }
  }
  const start = headers.FEN ?? (variant === 'threecheck' ? threeCheckInitialFen : variant === 'chess960' ? undefined : variant === 'horde' ? makeFen(Horde.default().toSetup()) : variant === 'crazyhouse' ? makeFen(Crazyhouse.default().toSetup()) : variant === 'giveaway' ? makeFen(Antichess.default().toSetup()) : variant === 'racingkings' ? makeFen(RacingKings.default().toSetup()) : new Chess().fen())
  if (!start) throw new Error('Chess960 PGNs require their starting FEN; standard chess is never assumed.')
  const board = new ChessopsBoard(start, variant)
  const initialFen = board.fen()
  const body = source.replace(/^\s*\[[^\r\n]*\]\s*$/gm, '').replace(/^%[^\r\n]*$/gm, '')
  const pattern = /\{[^}]*\}|;[^\r\n]*|\(|\)|[^\s(){};]+/g
  if (body.replace(pattern, '').trim()) throw new Error(`The ${name} PGN has an unclosed comment or invalid syntax.`)
  const moves: GameMove[] = []
  let variation = 0
  let ended = false
  let result = headers.Result ?? '*'
  for (const match of body.matchAll(pattern)) {
    const token = match[0]
    if (token === '(') { variation += 1; continue }
    if (token === ')') { if (!variation) throw new Error(`The ${name} PGN has unbalanced variations.`); variation -= 1; continue }
    if (variation || token.startsWith(';')) continue
    if (token.startsWith('{')) {
      const value = clock(token)
      if (!ended && moves.length && value !== undefined) moves[moves.length - 1].clockSeconds = value
      continue
    }
    const san = token.replace(/^\d+\.+/, '').replace(/\$\d+/g, '').replace(/[!?]+$/, '')
    if (!san || /^\.+$/.test(san)) continue
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(san)) { if (ended) throw new Error(`Provide one ${name} game at a time.`); ended = true; result = san; continue }
    if (ended) throw new Error(`Unexpected moves after the ${name} game result.`)
    try { moves.push(board.move(san)) }
    catch { throw new Error(`Illegal ${name} move at ply ${moves.length + 1}: ${san}.`) }
  }
  if (variation) throw new Error(`The ${name} PGN has unbalanced variations.`)
  return { variant, headers, initialFen, moves, positions: [initialFen, ...moves.map(move => move.after)], clocks: moves.map(move => move.clockSeconds ?? null), result }
}
