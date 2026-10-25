import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { parseChess960Pgn } from './chess960'
import { parseVariantPgn } from './variant-pgn'
import { pgnVariant, type ChessVariant } from './position'

export interface GamePlayer {
  username: string
  rating: number
  result: string
}

export interface GameRecord {
  id: string
  url: string
  pgn: string
  white: GamePlayer
  black: GamePlayer
  timeClass: string
  timeControl: string
  endTime: number
  rules: string
  eco?: string
}

export interface GameMove {
  ply: number
  san: string
  uci: string
  color: Color
  piece: PieceSymbol
  from: Square
  to: Square
  captured?: PieceSymbol
  promotion?: PieceSymbol
  drop?: PieceSymbol
  flags: string
  before: string
  after: string
  clockSeconds?: number
  kingTo?: Square
  rookFrom?: Square
  rookTo?: Square
}

export interface ParsedGame {
  variant?: ChessVariant
  headers: Record<string, string>
  moves: GameMove[]
  positions: string[]
  clocks: (number | null)[]
  initialFen: string
  result: string
}

function clockValue(comment: string): number | undefined {
  const match = comment.match(/\[%clk\s+(\d+(?::\d+){0,2}(?:\.\d+)?)\s*\]/i)
  if (!match) return undefined
  const parts = match[1].split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return undefined
  if (parts.slice(1).some((part) => part >= 60)) return undefined
  return parts.reduce((seconds, part) => seconds * 60 + part, 0)
}

function pgnClocks(pgn: string, moveCount: number): (number | null)[] {
  const clocks: (number | null)[] = Array(moveCount).fill(null)
  const body = pgn.replace(/^\s*\[[^\r\n]*\]\s*$/gm, '')
  const tokens = body.match(/\{[^}]*\}|;[^\r\n]*|\(|\)|[^\s(){};]+/g) ?? []
  let variation = 0
  let ply = -1
  for (const token of tokens) {
    if (token === '(') { variation += 1; continue }
    if (token === ')') { variation = Math.max(0, variation - 1); continue }
    if (variation || token.startsWith(';')) continue
    if (token.startsWith('{')) {
      const clock = clockValue(token)
      if (ply >= 0 && ply < moveCount && clock !== undefined) clocks[ply] = clock
      continue
    }
    const move = token.replace(/^\d+\.+/, '').replace(/\$\d+/g, '')
    if (!move || /^\.+$/.test(move) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(move)) continue
    ply += 1
  }
  return clocks
}

export function parsePgn(pgn: string, variant?: ChessVariant): ParsedGame {
  if (!pgn.trim()) throw new Error('The PGN is empty. Paste a game with legal moves.')
  const identified = pgnVariant(pgn)
  if (variant === 'chess' && identified === 'chess960') throw new Error('This PGN identifies Chess960 and cannot use standard chess rules.')
  if (variant && identified !== 'chess' && variant !== identified) throw new Error('The PGN variant conflicts with the selected game rules.')
  if (variant === 'threecheck' || identified === 'threecheck') return parseVariantPgn(pgn, 'threecheck')
  if (variant === 'kingofthehill' || identified === 'kingofthehill') return parseVariantPgn(pgn, 'kingofthehill')
  if (variant === 'atomic' || identified === 'atomic') return parseVariantPgn(pgn, 'atomic')
  if (variant === 'horde' || identified === 'horde') return parseVariantPgn(pgn, 'horde')
  if (variant === 'crazyhouse' || identified === 'crazyhouse') return parseVariantPgn(pgn, 'crazyhouse')
  if (variant === 'giveaway' || identified === 'giveaway') return parseVariantPgn(pgn, 'giveaway')
  if (variant === 'racingkings' || identified === 'racingkings') return parseVariantPgn(pgn, 'racingkings')
  if (variant === 'chess960' || identified === 'chess960') return parseChess960Pgn(pgn)
  const chess = new Chess()
  try {
    chess.loadPgn(pgn.replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`Cannot read this PGN: ${error instanceof Error ? error.message : 'invalid game'}`)
  }
  const history = chess.history({ verbose: true })
  const headers = chess.getHeaders()
  const initialFen = history[0]?.before ?? chess.fen()
  const clocks = pgnClocks(pgn, history.length)
  const moves: GameMove[] = history.map((move, index) => ({
    ply: index + 1,
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ''}`,
    color: move.color,
    piece: move.piece,
    from: move.from,
    to: move.to,
    captured: move.captured,
    promotion: move.promotion,
    flags: move.flags,
    before: move.before,
    after: move.after,
    clockSeconds: clocks[index] ?? undefined,
  }))
  return { variant: 'chess', headers, moves, positions: [initialFen, ...moves.map((move) => move.after)], clocks, initialFen, result: headers.Result ?? '*' }
}

export function engineRules(rules: string): ChessVariant | null {
  return rules === 'threecheck' ? 'threecheck' : rules === 'kingofthehill' ? 'kingofthehill' : rules === 'atomic' ? 'atomic' : rules === 'horde' ? 'horde' : rules === 'crazyhouse' ? 'crazyhouse' : rules === 'giveaway' ? 'giveaway' : rules === 'racingkings' ? 'racingkings' : rules === 'chess960' ? 'chess960' : rules === 'chess' || rules === 'oddschess' ? 'chess' : null
}

export function parseGame(game: GameRecord): ParsedGame {
  const variant = engineRules(game.rules)
  if (!variant) throw new Error(`This game uses ${game.rules}. Engine review supports standard chess, material odds, Chess960, three-check, King of the Hill, Atomic, Horde, Crazyhouse, Giveaway, and Racing Kings.`)
  return parsePgn(game.pgn, variant)
}

export function gameMoveCount(game: GameRecord): number | null {
  try { return parseGame(game).moves.length } catch { return null }
}

function pgnResult(result: string, color: Color): string {
  if (result === '*') return 'unfinished'
  if (result === '1/2-1/2') return 'agreed'
  return result === (color === 'w' ? '1-0' : '0-1') ? 'win' : 'resigned'
}

function pgnId(pgn: string): string {
  let hash = 2166136261
  for (let index = 0; index < pgn.length; index += 1) hash = Math.imul(hash ^ pgn.charCodeAt(index), 16777619)
  return `pgn-${(hash >>> 0).toString(16)}`
}

export function gameFromPgn(pgn: string): GameRecord {
  const { headers, result, variant } = parsePgn(pgn)
  const date = headers.UTCDate ?? headers.Date ?? ''
  const timestamp = Date.parse(`${date.replace(/\./g, '-')}T${headers.UTCTime ?? '00:00:00'}Z`)
  return {
    id: pgnId(pgn),
    url: headers.Link ?? '',
    pgn,
    white: { username: headers.White || 'White', rating: Number(headers.WhiteElo) || 0, result: pgnResult(result, 'w') },
    black: { username: headers.Black || 'Black', rating: Number(headers.BlackElo) || 0, result: pgnResult(result, 'b') },
    timeClass: 'imported',
    timeControl: headers.TimeControl ?? '-',
    endTime: Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0,
    rules: variant ?? 'chess',
    eco: headers.ECO ?? headers.ECOUrl,
  }
}

export function formatClock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const value = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const remainder = String(value % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`
}
