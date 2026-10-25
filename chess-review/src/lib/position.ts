import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { Chess960Board } from './chess960'
import { ChessopsBoard } from './chessops-board'
import { threeCheckInitialFen, type ChessVariant } from './variants'
export { pgnVariant, variantLabel, type ChessVariant } from './variants'

export interface PositionMove {
  color: Color
  piece: PieceSymbol
  from: Square
  to: Square
  san: string
  flags: string
  before: string
  after: string
  captured?: PieceSymbol
  promotion?: PieceSymbol
  uci?: string
  kingTo?: Square
  rookFrom?: Square
  rookTo?: Square
}
type Piece = { type: PieceSymbol; color: Color }
export interface ChessPosition {
  fen(): string
  turn(): Color
  get(square: Square): Piece | undefined
  board(): ({ square: Square } & Piece | null)[][]
  moves(options: { square?: Square; verbose: true }): PositionMove[]
  moves(options?: { square?: Square; verbose?: false }): string[]
  move(input: string | { from: string; to: string; promotion?: string }): PositionMove
  history(options: { verbose: true }): PositionMove[]
  history(options?: { verbose?: false }): string[]
  undo(): PositionMove | null
  remove(square: Square): Piece | undefined
  isCheck(): boolean
  isCheckmate(): boolean
  isStalemate(): boolean
  isInsufficientMaterial(): boolean
  isThreefoldRepetition(): boolean
  isDrawByFiftyMoves(): boolean
  isDraw(): boolean
  isGameOver(): boolean
  attackers(square: Square, color?: Color): Square[]
  isAttacked(square: Square, color: Color): boolean
  variantOutcome?(): { winner?: Color; reason: 'third-check' | 'king-of-the-hill' } | null
  checksRemaining?(): { w: number; b: number } | null
}

export function resolveVariant(fen: string, variant?: ChessVariant): ChessVariant {
  if (variant !== undefined && !['chess', 'chess960', 'threecheck', 'kingofthehill'].includes(variant)) throw new Error('Unsupported chess variant.')
  const fields = fen.split(/\s+/)
  const checks = [fields[4], fields[6]].some(field => field && /^(?:[0-3]\+[0-3]|\+[0-3]\+[0-3])$/.test(field))
  if (checks && variant && variant !== 'threecheck') throw new Error('This position has three-check counters and cannot use other chess rules.')
  const shredder = /[A-Ha-h]/.test(fen.split(/\s+/)[2] ?? '')
  if (variant === 'chess' && shredder) throw new Error('This position has Chess960 castling rights and cannot use standard chess rules.')
  return variant ?? (checks ? 'threecheck' : shredder ? 'chess960' : 'chess')
}

export function createPosition(fen?: string, variant?: ChessVariant): ChessPosition {
  if (fen === undefined) {
    if (variant !== undefined && !['chess', 'chess960', 'threecheck', 'kingofthehill'].includes(variant)) throw new Error('Unsupported chess variant.')
    if (variant === 'chess960') throw new Error('Chess960 requires its starting FEN.')
    if (variant === 'threecheck') return new ChessopsBoard(threeCheckInitialFen, 'threecheck')
    if (variant === 'kingofthehill') return new ChessopsBoard(new Chess().fen(), 'kingofthehill')
    return new Chess()
  }
  const rules = resolveVariant(fen, variant)
  return rules === 'threecheck' || rules === 'kingofthehill' ? new ChessopsBoard(fen, rules) : rules === 'chess960' ? new Chess960Board(fen) : new Chess(fen)
}

export const positionMoveUci = (move: PositionMove): string => move.uci ?? `${move.from}${move.to}${move.promotion ?? ''}`
