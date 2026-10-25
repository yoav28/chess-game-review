import { Chess, castlingSide, normalizeMove, type Position } from 'chessops/chess'
import { attacks } from 'chessops/attacks'
import { makeFen, parseFen } from 'chessops/fen'
import { makeSan, parseSan } from 'chessops/san'
import { charToRole, kingCastlesTo, makeSquare, makeUci, parseSquare, parseUci, roleToChar, rookCastlesTo } from 'chessops/util'
import { isDrop, isNormal, type Move, type NormalMove } from 'chessops/types'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { GameMove } from './game'
import { Atomic, Crazyhouse, Horde, KingOfTheHill, ThreeCheck } from 'chessops/variant'

type MoveInput = string | { from: string; to: string; promotion?: string }
type Piece = { square: Square; type: PieceSymbol; color: Color }
const color = (turn: 'white' | 'black'): Color => turn === 'white' ? 'w' : 'b'
const square = (value: number) => makeSquare(value) as Square

export class ChessopsBoard {
  private position: Position
  private played: GameMove[] = []
  private positions: string[]

  constructor(fen: string, private readonly rules: 'chess960' | 'threecheck' | 'kingofthehill' | 'atomic' | 'horde' | 'crazyhouse') {
    try {
      const setup = parseFen(fen).unwrap()
      if (setup.pockets && rules !== 'crazyhouse') throw new Error('Pocket pieces require Crazyhouse rules.')
      if (rules === 'threecheck' && !setup.remainingChecks || rules !== 'threecheck' && setup.remainingChecks) throw new Error('Missing or unexpected check counters.')
      if (rules === 'threecheck' && setup.remainingChecks) {
        const { white, black } = setup.remainingChecks
        if (white === 0 && black === 0 || white === 0 && setup.turn !== 'black' || black === 0 && setup.turn !== 'white') throw new Error('Invalid third-check outcome.')
        for (const rook of setup.castlingRights) {
          const king = setup.board.get(rook < 8 ? 4 : 60)
          if (![0, 7, 56, 63].includes(rook) || king?.role !== 'king' || king.color !== (rook < 8 ? 'white' : 'black')) throw new Error('Combined Chess960 and three-check castling is unsupported.')
        }
      }
      this.position = (rules === 'threecheck' ? ThreeCheck.fromSetup(setup) : rules === 'kingofthehill' ? KingOfTheHill.fromSetup(setup) : rules === 'atomic' ? Atomic.fromSetup(setup) : rules === 'horde' ? Horde.fromSetup(setup) : rules === 'crazyhouse' ? Crazyhouse.fromSetup(setup) : Chess.fromSetup(setup)).unwrap()
      if (!setup.castlingRights.equals(this.position.castles.castlingRights)) throw new Error('Invalid castling rights.')
    }
    catch { throw new Error(rules === 'chess960' ? 'Invalid Chess960 FEN. A legal position with both kings is required.' : rules === 'threecheck' ? 'Invalid three-check FEN. Legal kings, check counters, and standard castling are required.' : rules === 'kingofthehill' ? 'Invalid King of the Hill FEN. A legal position with both kings is required.' : rules === 'atomic' ? 'Invalid Atomic FEN. A legal position with both kings is required.' : rules === 'horde' ? 'Invalid Horde FEN. One legal king and the Horde setup are required.' : 'Invalid Crazyhouse FEN. A legal position and pocket pieces are required.') }
    this.positions = [this.fen()]
  }

  fen(): string {
    const setup = this.position.toSetup()
    const parts = makeFen(setup).split(' ')
    if (this.rules === 'threecheck') return [...parts.slice(0, 4), String(setup.halfmoves), String(setup.fullmoves), `+${3 - setup.remainingChecks!.white}+${3 - setup.remainingChecks!.black}`].join(' ')
    if (this.rules === 'chess960') parts[2] = [...setup.castlingRights].sort((a, b) => Math.floor(a / 8) - Math.floor(b / 8) || b % 8 - a % 8)
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
  pockets(): { w: Partial<Record<PieceSymbol, number>>; b: Partial<Record<PieceSymbol, number>> } | null {
    const pockets = this.position.pockets
    if (!pockets) return null
    const read = (side: typeof pockets.white) => Object.fromEntries(([
      ['p', 'pawn'], ['n', 'knight'], ['b', 'bishop'], ['r', 'rook'], ['q', 'queen'],
    ] as const).flatMap(([piece, role]) => side[role] > 0 ? [[piece, side[role]]] : [])) as Partial<Record<PieceSymbol, number>>
    return { w: read(pockets.white), b: read(pockets.black) }
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
  variantOutcome(): { winner?: Color; reason: 'third-check' | 'king-of-the-hill' | 'atomic-win' | 'horde-win' } | null {
    const outcome = this.rules === 'threecheck' || this.rules === 'kingofthehill' || this.rules === 'atomic' || this.rules === 'horde' ? this.position.variantOutcome() : undefined
    if (!outcome) return null
    return this.rules === 'threecheck'
      ? { winner: outcome.winner ? color(outcome.winner) : undefined, reason: 'third-check' }
      : this.rules === 'kingofthehill'
        ? { winner: outcome.winner ? color(outcome.winner) : undefined, reason: 'king-of-the-hill' }
        : this.rules === 'atomic'
          ? { winner: outcome.winner ? color(outcome.winner) : undefined, reason: 'atomic-win' }
          : { winner: outcome.winner ? color(outcome.winner) : undefined, reason: 'horde-win' }
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

  private legal(squareName?: Square): Move[] {
    const result: Move[] = []
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
    if (!squareName && this.rules === 'crazyhouse') {
      const house = this.position as Crazyhouse
      const pocket = house.pockets?.[house.turn]
      if (pocket) for (const [char, role] of [['p', 'pawn'], ['n', 'knight'], ['b', 'bishop'], ['r', 'rook'], ['q', 'queen']] as const) {
        if (pocket[role] <= 0) continue
        for (const to of house.dropDests()) {
          const move = { role: charToRole(char), to }
          if (house.isLegal(move)) result.push(move)
        }
      }
    }
    return result
  }

  private describe(move: Move): GameMove {
    const drop = isDrop(move)
    const normal = drop ? undefined : normalizeMove(this.position, move as NormalMove) as NormalMove
    const role = drop ? move.role : this.position.board.get(normal!.from)!.role
    const side = normal ? castlingSide(this.position, normal) : undefined
    const ep = normal && role === 'pawn' && normal.to === this.position.epSquare && !this.position.board.has(normal.to)
    const captured = drop ? undefined : side ? undefined : ep ? 'p' : this.position.board.get(move.to)?.role
    const after = this.position.clone()
    after.play(move)
    const flags = drop ? 'd' : side ? side === 'h' ? 'k' : 'q' : ep ? 'e' : `${captured ? 'c' : role === 'pawn' && Math.abs(normal!.from - move.to) === 16 ? 'b' : normal!.promotion ? '' : 'n'}${normal!.promotion ? 'p' : ''}`
    const next = new ChessopsBoard(makeFen(after.toSetup()), this.rules)
    const destination = side && this.rules === 'threecheck' ? kingCastlesTo(this.position.turn, side) : move.to
    const from = drop ? move.to : normal!.from
    const san = drop ? `${roleToChar(role).toUpperCase()}@${makeSquare(move.to)}` : makeSan(this.position, move)
    const uci = drop || this.rules === 'chess960' ? makeUci(move) : `${makeSquare(normal!.from)}${makeSquare(destination)}${normal!.promotion ? roleToChar(normal!.promotion) : ''}`
    return {
      ply: this.played.length + 1, san, uci,
      color: color(this.position.turn), piece: roleToChar(role), from: square(from), to: square(destination), drop: drop ? roleToChar(role) : undefined,
      captured: captured === 'p' ? 'p' : captured ? roleToChar(captured) : undefined,
      promotion: normal?.promotion ? roleToChar(normal.promotion) : undefined, flags, before: this.fen(), after: next.fen(),
      ...(side && normal ? { kingTo: square(kingCastlesTo(this.position.turn, side)), rookFrom: square(normal.to), rookTo: square(rookCastlesTo(this.position.turn, side)) } : {}),
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
      ? (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input) ? parseUci(input) : /^[PNBRQ]@[a-h][1-8]$/i.test(input) ? parseUci(`${input[0].toUpperCase()}@${input.slice(2).toLowerCase()}`) : parseSan(this.position, input.replace(/0/g, 'O').replace(/[!?]+$/, '')))
      : parseUci(`${input.from}${input.to}${input.promotion ?? ''}`)
    const illegal = this.rules === 'chess960' ? 'Illegal Chess960 move.' : this.rules === 'threecheck' ? 'Illegal three-check move.' : this.rules === 'kingofthehill' ? 'Illegal King of the Hill move.' : this.rules === 'atomic' ? 'Illegal Atomic move.' : this.rules === 'horde' ? 'Illegal Horde move.' : 'Illegal Crazyhouse move.'
    if (!move || !this.position.isLegal(move)) throw new Error(illegal)
    const record = this.describe(move)
    this.position.play(move)
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
    const setup = parseFen(move.before).unwrap()
    this.position = (this.rules === 'threecheck' ? ThreeCheck.fromSetup(setup) : this.rules === 'kingofthehill' ? KingOfTheHill.fromSetup(setup) : this.rules === 'atomic' ? Atomic.fromSetup(setup) : this.rules === 'horde' ? Horde.fromSetup(setup) : this.rules === 'crazyhouse' ? Crazyhouse.fromSetup(setup) : Chess.fromSetup(setup)).unwrap()
    this.positions.pop()
    return { ...move }
  }
}
