import { Chess, castlingSide, normalizeMove, type Position } from 'chessops/chess'
import { attacks } from 'chessops/attacks'
import { makeFen, parseFen } from 'chessops/fen'
import { makeSan, parseSan } from 'chessops/san'
import { charToRole, kingCastlesTo, makeSquare, makeUci, parseSquare, parseUci, roleToChar, rookCastlesTo } from 'chessops/util'
import { isNormal, type NormalMove } from 'chessops/types'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { GameMove } from './game'
import { ThreeCheck } from 'chessops/variant'

type MoveInput = string | { from: string; to: string; promotion?: string }
type Piece = { square: Square; type: PieceSymbol; color: Color }
const color = (turn: 'white' | 'black'): Color => turn === 'white' ? 'w' : 'b'
const square = (value: number) => makeSquare(value) as Square

export class ChessopsBoard {
  private position: Position
  private played: GameMove[] = []
  private positions: string[]

  constructor(fen: string, private readonly rules: 'chess960' | 'threecheck') {
    try {
      const setup = parseFen(fen).unwrap()
      if (setup.pockets) throw new Error('Drop-piece variants are unsupported.')
      if (rules === 'threecheck' && !setup.remainingChecks || rules === 'chess960' && setup.remainingChecks) throw new Error('Missing or unexpected check counters.')
      if (rules === 'threecheck' && setup.remainingChecks) {
        const { white, black } = setup.remainingChecks
        if (white === 0 && black === 0 || white === 0 && setup.turn !== 'black' || black === 0 && setup.turn !== 'white') throw new Error('Invalid third-check outcome.')
        for (const rook of setup.castlingRights) {
          const king = setup.board.get(rook < 8 ? 4 : 60)
          if (![0, 7, 56, 63].includes(rook) || king?.role !== 'king' || king.color !== (rook < 8 ? 'white' : 'black')) throw new Error('Combined Chess960 and three-check castling is unsupported.')
        }
      }
      this.position = (rules === 'threecheck' ? ThreeCheck.fromSetup(setup) : Chess.fromSetup(setup)).unwrap()
      if (!setup.castlingRights.equals(this.position.castles.castlingRights)) throw new Error('Invalid castling rights.')
    }
    catch { throw new Error(rules === 'chess960' ? 'Invalid Chess960 FEN. A legal position with both kings is required.' : 'Invalid three-check FEN. Legal kings, check counters, and standard castling are required.') }
    this.positions = [this.fen()]
  }

  fen(): string {
    const setup = this.position.toSetup()
    const parts = makeFen(setup).split(' ')
    if (this.rules === 'threecheck') return [...parts.slice(0, 4), String(setup.halfmoves), String(setup.fullmoves), `+${3 - setup.remainingChecks!.white}+${3 - setup.remainingChecks!.black}`].join(' ')
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
    const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ') + (this.rules === 'threecheck' ? ` ${fen.split(' ')[6]}` : '')
    return this.positions.filter(fen => key(fen) === key(this.fen())).length >= 3
  }
  isDraw(): boolean { return !this.variantOutcome() && (this.isStalemate() || this.isInsufficientMaterial() || this.isDrawByFiftyMoves() || this.isThreefoldRepetition()) }
  isGameOver(): boolean { return !!this.variantOutcome() || this.isCheckmate() || this.isDraw() }
  variantOutcome(): { winner: Color; reason: 'third-check' } | null {
    const outcome = this.rules === 'threecheck' ? this.position.variantOutcome() : undefined
    return outcome?.winner ? { winner: color(outcome.winner), reason: 'third-check' } : null
  }
  checksRemaining(): { w: number; b: number } | null {
    const checks = this.position.remainingChecks
    return checks ? { w: checks.white, b: checks.black } : null
  }
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

  private describe(move: NormalMove): GameMove {
    const normalized = normalizeMove(this.position, move) as NormalMove
    const piece = this.position.board.get(normalized.from)!
    const side = castlingSide(this.position, normalized)
    const ep = piece.role === 'pawn' && normalized.to === this.position.epSquare && !this.position.board.has(normalized.to)
    const captured = side ? undefined : ep ? 'p' : this.position.board.get(normalized.to)?.role
    const after = this.position.clone()
    after.play(normalized)
    const flags = side ? side === 'h' ? 'k' : 'q' : ep ? 'e' : `${captured ? 'c' : piece.role === 'pawn' && Math.abs(normalized.from - normalized.to) === 16 ? 'b' : normalized.promotion ? '' : 'n'}${normalized.promotion ? 'p' : ''}`
    const next = new ChessopsBoard(makeFen(after.toSetup()), this.rules)
    const destination = side && this.rules === 'threecheck' ? kingCastlesTo(piece.color, side) : normalized.to
    return {
      ply: this.played.length + 1, san: makeSan(this.position, normalized), uci: this.rules === 'chess960' ? makeUci(normalized) : `${makeSquare(normalized.from)}${makeSquare(destination)}${normalized.promotion ? roleToChar(normalized.promotion) : ''}`,
      color: color(piece.color), piece: roleToChar(piece.role), from: square(normalized.from), to: square(destination),
      captured: captured === 'p' ? 'p' : captured ? roleToChar(captured) : undefined,
      promotion: normalized.promotion ? roleToChar(normalized.promotion) : undefined, flags, before: this.fen(), after: next.fen(),
      ...(side ? { kingTo: square(kingCastlesTo(piece.color, side)), rookFrom: square(normalized.to), rookTo: square(rookCastlesTo(piece.color, side)) } : {}),
    }
  }

  moves(options: { square?: Square; verbose: true }): GameMove[]
  moves(options?: { square?: Square; verbose?: false }): string[]
  moves(options: { square?: Square; verbose?: boolean } = {}): GameMove[] | string[] {
    const legal = this.legal(options.square)
    return options.verbose ? legal.map(move => this.describe(move)) : legal.map(move => makeSan(this.position, move))
  }

  move(input: MoveInput): GameMove {
    const move = typeof input === 'string'
      ? (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input) ? parseUci(input) : parseSan(this.position, input.replace(/0/g, 'O').replace(/[!?]+$/, '')))
      : parseUci(`${input.from}${input.to}${input.promotion ?? ''}`)
    const illegal = this.rules === 'chess960' ? 'Illegal Chess960 move.' : 'Illegal three-check move.'
    if (!move || !isNormal(move)) throw new Error(illegal)
    const normalized = normalizeMove(this.position, move) as NormalMove
    if (!this.position.isLegal(normalized)) throw new Error(illegal)
    const record = this.describe(normalized)
    this.position.play(normalized)
    this.played.push(record)
    this.positions.push(record.after)
    return { ...record }
  }

  history(options: { verbose: true }): GameMove[]
  history(options?: { verbose?: false }): string[]
  history(options: { verbose?: boolean } = {}): GameMove[] | string[] { return options.verbose ? this.played.map(move => ({ ...move })) : this.played.map(move => move.san) }
  undo(): GameMove | null {
    const move = this.played.pop()
    if (!move) return null
    this.position = (this.rules === 'threecheck' ? ThreeCheck.fromSetup(parseFen(move.before).unwrap()) : Chess.fromSetup(parseFen(move.before).unwrap())).unwrap()
    this.positions.pop()
    return { ...move }
  }
}
