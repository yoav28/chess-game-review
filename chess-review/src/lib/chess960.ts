import { Chess as Position, castlingSide, normalizeMove } from 'chessops/chess'
import { attacks } from 'chessops/attacks'
import { makeFen, parseFen } from 'chessops/fen'
import { makeSan, parseSan } from 'chessops/san'
import { charToRole, kingCastlesTo, makeSquare, makeUci, parseSquare, parseUci, roleToChar, rookCastlesTo } from 'chessops/util'
import { isNormal, type NormalMove } from 'chessops/types'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { GameMove, ParsedGame } from './game'

export interface Chess960Move extends GameMove {
  kingTo?: Square
  rookFrom?: Square
  rookTo?: Square
}
export interface Chess960ParsedGame extends ParsedGame { variant: 'chess960' }
type MoveInput = string | { from: string; to: string; promotion?: string }
type Piece = { square: Square; type: PieceSymbol; color: Color }
const color = (turn: 'white' | 'black'): Color => turn === 'white' ? 'w' : 'b'
const square = (value: number) => makeSquare(value) as Square

export class Chess960Board {
  private position: Position
  private played: Chess960Move[] = []
  private positions: string[]

  constructor(fen: string) {
    try {
      const setup = parseFen(fen).unwrap()
      this.position = Position.fromSetup(setup).unwrap()
      if (!setup.castlingRights.equals(this.position.castles.castlingRights)) throw new Error('Invalid castling rights.')
    }
    catch { throw new Error('Invalid Chess960 FEN. A legal position with both kings is required.') }
    this.positions = [this.fen()]
  }

  fen(): string {
    const setup = this.position.toSetup()
    const parts = makeFen(setup).split(' ')
    parts[2] = [...setup.castlingRights].sort((a, b) => Math.floor(a / 8) - Math.floor(b / 8) || b % 8 - a % 8)
      .map(rook => { const file = makeSquare(rook)[0]; return rook < 8 ? file.toUpperCase() : file }).join('') || '-'
    return parts.join(' ')
  }

  turn(): Color { return color(this.position.turn) }
  get(name: Square): Piece | undefined {
    const index = parseSquare(name)
    const piece = index === undefined ? undefined : this.position.board.get(index)
    return piece && { square: name, type: roleToChar(piece.role), color: color(piece.color) }
  }
  board(): (Piece | null)[][] {
    return Array.from({ length: 8 }, (_, rank) => Array.from({ length: 8 }, (_, file) => this.get(square((7 - rank) * 8 + file)) ?? null))
  }
  isCheck(): boolean { return this.position.isCheck() }
  isCheckmate(): boolean { return this.position.isCheckmate() }
  isStalemate(): boolean { return this.position.isStalemate() }
  isInsufficientMaterial(): boolean { return this.position.isInsufficientMaterial() }
  isDrawByFiftyMoves(): boolean { return this.position.halfmoves >= 100 }
  isThreefoldRepetition(): boolean {
    const key = this.fen().split(' ').slice(0, 4).join(' ')
    return this.positions.filter(fen => fen.split(' ').slice(0, 4).join(' ') === key).length >= 3
  }
  isDraw(): boolean { return this.isStalemate() || this.isInsufficientMaterial() || this.isDrawByFiftyMoves() || this.isThreefoldRepetition() }
  isGameOver(): boolean { return this.isCheckmate() || this.isDraw() }
  attackers(name: Square, by?: Color): Square[] {
    const target = parseSquare(name)
    if (target === undefined) return []
    return [...this.position.board].filter(([from, piece]) => (!by || color(piece.color) === by) && attacks(piece, from, this.position.board.occupied).has(target)).map(([from]) => square(from))
  }
  isAttacked(name: Square, by: Color): boolean { return this.attackers(name, by).length > 0 }
  remove(name: Square): Piece | undefined {
    const piece = this.get(name)
    const index = parseSquare(name)
    if (piece && index !== undefined) {
      this.position.board.take(index)
      this.position.castles.discardRook(index)
      if (piece.type === 'k') this.position.castles.discardColor(piece.color === 'w' ? 'white' : 'black')
    }
    return piece
  }

  private legal(squareName?: Square): NormalMove[] {
    const result: NormalMove[] = []
    for (const [from, destinations] of this.position.allDests()) {
      if (squareName && makeSquare(from) !== squareName) continue
      for (const to of destinations) {
        const promotions = this.position.board.pawn.has(from) && (to < 8 || to >= 56) ? ['q', 'r', 'b', 'n'] : [undefined]
        for (const promotion of promotions) {
          const move: NormalMove = { from, to, promotion: promotion ? charToRole(promotion) : undefined }
          if (this.position.isLegal(move)) result.push(move)
        }
      }
    }
    return result
  }

  private describe(move: NormalMove): Chess960Move {
    const normalized = normalizeMove(this.position, move) as NormalMove
    const piece = this.position.board.get(normalized.from)!
    const side = castlingSide(this.position, normalized)
    const ep = piece.role === 'pawn' && normalized.to === this.position.epSquare && !this.position.board.has(normalized.to)
    const captured = side ? undefined : ep ? 'p' : this.position.board.get(normalized.to)?.role
    const after = this.position.clone()
    after.play(normalized)
    const flags = side ? side === 'h' ? 'k' : 'q' : ep ? 'e' : `${captured ? 'c' : piece.role === 'pawn' && Math.abs(normalized.from - normalized.to) === 16 ? 'b' : normalized.promotion ? '' : 'n'}${normalized.promotion ? 'p' : ''}`
    const next = new Chess960Board(makeFen(after.toSetup()))
    return {
      ply: this.played.length + 1, san: makeSan(this.position, normalized), uci: makeUci(normalized),
      color: color(piece.color), piece: roleToChar(piece.role), from: square(normalized.from), to: square(normalized.to),
      captured: captured === 'p' ? 'p' : captured ? roleToChar(captured) : undefined,
      promotion: normalized.promotion ? roleToChar(normalized.promotion) : undefined, flags, before: this.fen(), after: next.fen(),
      ...(side ? { kingTo: square(kingCastlesTo(piece.color, side)), rookFrom: square(normalized.to), rookTo: square(rookCastlesTo(piece.color, side)) } : {}),
    }
  }

  moves(options: { square?: Square; verbose: true }): Chess960Move[]
  moves(options?: { square?: Square; verbose?: false }): string[]
  moves(options: { square?: Square; verbose?: boolean } = {}): Chess960Move[] | string[] {
    const legal = this.legal(options.square)
    return options.verbose ? legal.map(move => this.describe(move)) : legal.map(move => makeSan(this.position, move))
  }

  move(input: MoveInput): Chess960Move {
    const move = typeof input === 'string'
      ? (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input) ? parseUci(input) : parseSan(this.position, input.replace(/0/g, 'O').replace(/[!?]+$/, '')))
      : parseUci(`${input.from}${input.to}${input.promotion ?? ''}`)
    if (!move || !isNormal(move) || !this.position.isLegal(move)) throw new Error('Illegal Chess960 move.')
    const record = this.describe(move)
    this.position.play(normalizeMove(this.position, move))
    this.played.push(record)
    this.positions.push(record.after)
    return { ...record }
  }

  history(options: { verbose: true }): Chess960Move[]
  history(options?: { verbose?: false }): string[]
  history(options: { verbose?: boolean } = {}): Chess960Move[] | string[] { return options.verbose ? this.played.map(move => ({ ...move })) : this.played.map(move => move.san) }
  undo(): Chess960Move | null {
    const move = this.played.pop()
    if (!move) return null
    this.position = Position.fromSetup(parseFen(move.before).unwrap()).unwrap()
    this.positions.pop()
    return { ...move }
  }
}

function clock(comment: string): number | undefined {
  const match = comment.match(/\[%clk\s+(\d+(?::\d+){0,2}(?:\.\d+)?)\s*\]/i)
  if (!match) return undefined
  const parts = match[1].split(':').map(Number)
  if (parts.some(value => !Number.isFinite(value) || value < 0) || parts.slice(1).some(value => value >= 60)) return undefined
  return parts.reduce((seconds, value) => seconds * 60 + value, 0)
}

export function parseChess960Pgn(pgn: string): Chess960ParsedGame {
  if (!pgn.trim()) throw new Error('The Chess960 PGN is empty.')
  const source = pgn.replace(/^\uFEFF/, '')
  const headers = Object.fromEntries([...source.matchAll(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)].map(match => [match[1], match[2].replace(/\\(["\\])/g, '$1')]))
  if (headers.Variant && !/^(Chess960|Fischerandom|Fischer Random|Freestyle)$/i.test(headers.Variant)) throw new Error('This PGN does not identify a Chess960 game.')
  if (!headers.FEN) throw new Error('Chess960 PGNs require their starting FEN; standard chess is never assumed.')
  const board = new Chess960Board(headers.FEN)
  const initialFen = board.fen()
  const body = source.replace(/^\s*\[[^\r\n]*\]\s*$/gm, '').replace(/^%[^\r\n]*$/gm, '')
  const pattern = /\{[^}]*\}|;[^\r\n]*|\(|\)|[^\s(){};]+/g
  if (body.replace(pattern, '').trim()) throw new Error('The Chess960 PGN has an unclosed comment or invalid syntax.')
  const moves: Chess960Move[] = []
  let variation = 0
  let ended = false
  let result = headers.Result ?? '*'
  for (const match of body.matchAll(pattern)) {
    const token = match[0]
    if (token === '(') { variation += 1; continue }
    if (token === ')') { if (!variation) throw new Error('The Chess960 PGN has unbalanced variations.'); variation -= 1; continue }
    if (variation || token.startsWith(';')) continue
    if (token.startsWith('{')) {
      const value = clock(token)
      if (!ended && moves.length && value !== undefined) moves[moves.length - 1].clockSeconds = value
      continue
    }
    const san = token.replace(/^\d+\.+/, '').replace(/\$\d+/g, '').replace(/[!?]+$/, '')
    if (!san || /^\.+$/.test(san)) continue
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(san)) { if (ended) throw new Error('Provide one Chess960 game at a time.'); ended = true; result = san; continue }
    if (ended) throw new Error('Unexpected moves after the Chess960 game result.')
    try { moves.push(board.move(san)) }
    catch { throw new Error(`Illegal Chess960 move at ply ${moves.length + 1}: ${san}.`) }
  }
  if (variation) throw new Error('The Chess960 PGN has unbalanced variations.')
  return { variant: 'chess960', headers, initialFen, moves, positions: [initialFen, ...moves.map(move => move.after)], clocks: moves.map(move => move.clockSeconds ?? null), result }
}
