import type { Color, PieceSymbol, Square } from 'chess.js'
import { createPosition, type ChessPosition, type ChessVariant, type PositionMove } from './position'
import type { ParsedMove } from './review'

export const insightMethod = 'Conceptual coaching uses position-based rule heuristics. It describes selected structures and threats without claiming a move is good or that material can be won.'

const names: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const value: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 }
const center: Square[] = ['d4', 'e4', 'd5', 'e5']
const opposite = (color: Color): Color => color === 'w' ? 'b' : 'w'
const pieces = (board: ChessPosition) => board.board().flat().filter(piece => piece !== null)

function pinnedBy(board: ChessPosition, attacker: Square, blocker: Square, king: Square, color: Color, variant?: ChessVariant): boolean {
  if (!board.get(blocker) || !board.attackers(blocker, color).includes(attacker)) return false
  const withoutBlocker = createPosition(board.fen(), variant)
  withoutBlocker.remove(blocker)
  return withoutBlocker.attackers(king, color).includes(attacker)
}

export function insightsForMove(move: ParsedMove): string[] {
  const before = createPosition(move.beforeFen, move.variant)
  const after = createPosition(move.afterFen, move.variant)
  const outcome = after.variantOutcome?.()
  if (outcome) {
    const reason = outcome.reason === 'third-check' ? 'by delivering the third check' : outcome.reason === 'king-of-the-hill' ? 'by reaching the hill' : 'by exploding the opposing king'
    return [`${outcome.winner === 'w' ? 'White' : 'Black'} wins ${reason}.`]
  }
  if (after.isCheckmate() || move.san.startsWith('O-O')) return []
  const from = move.from as Square
  const to = move.to as Square
  const piece = after.get(to)
  if (!piece || piece.color !== move.color) return []
  const enemy = opposite(move.color)
  const candidates: { priority: number; text: string }[] = []
  const add = (priority: number, text: string) => candidates.push({ priority, text })
  const checks = after.checksRemaining?.()
  if (checks && after.isCheck()) add(200, `${move.color === 'w' ? 'White' : 'Black'} has delivered ${3 - checks[move.color]} of 3 checks.`)
  const allPieces = pieces(after)

  const legalEnemyCaptures = after.moves({ verbose: true }).filter(reply => reply.to === to && reply.captured)
  if (legalEnemyCaptures.length && after.attackers(to, move.color).length === 0) {
    add(100, `The ${names[piece.type]} on ${to} can be captured and has no direct defender.`)
  }

  if (['b', 'r', 'q'].includes(piece.type)) {
    const king = allPieces.find(target => target.color === enemy && target.type === 'k')
    if (king && !after.attackers(king.square, move.color).includes(to)) {
      const blocker = allPieces.find(target => target.color === enemy && target.type !== 'k'
        && pinnedBy(after, to, target.square, king.square, move.color, move.variant)
        && !pinnedBy(before, from, target.square, king.square, move.color, move.variant))
      if (blocker) add(90, `The ${names[piece.type]} pins the ${names[blocker.type]} on ${blocker.square} to the king.`)
    }
  }

  const nextTurnFen = after.fen().split(' ')
  nextTurnFen[1] = move.color
  nextTurnFen[3] = '-'
  let captures: PositionMove[] = []
  try { captures = createPosition(nextTurnFen.join(' '), move.variant).moves({ square: to, verbose: true }).filter(candidate => candidate.captured) }
  catch {}
  const forkTargets = allPieces.filter(target => target.color === enemy && value[target.type] >= 3
    && after.attackers(target.square, move.color).includes(to)
    && (target.type === 'k' || captures.some(capture => capture.to === target.square)))
    .sort((a, b) => value[b.type] - value[a.type])
  if (forkTargets.length >= 2) {
    const targets = forkTargets.slice(0, 2).map(target => `the ${names[target.type]} on ${target.square}`)
    add(85, `The ${names[piece.type]} attacks ${targets.join(' and ')}, creating fork pressure.`)
  }

  if (piece.type === 'p') {
    const pawnFile = to.charCodeAt(0)
    const pawnRank = Number(to[1])
    const blockers = allPieces.some(target => target.color === enemy && target.type === 'p'
      && Math.abs(target.square.charCodeAt(0) - pawnFile) <= 1
      && (move.color === 'w' ? Number(target.square[1]) > pawnRank : Number(target.square[1]) < pawnRank))
    if (!blockers) add(75, `The pawn on ${to} is passed: no opposing pawn stands ahead on its file or an adjacent file.`)
  }

  if (piece.type === 'r') {
    const filePawns = allPieces.filter(target => target.type === 'p' && target.square[0] === to[0])
    if (!filePawns.some(pawn => pawn.color === move.color)) {
      add(70, `The rook occupies the ${filePawns.length ? 'semi-open' : 'open'} ${to[0]}-file${filePawns.length ? ', which has no friendly pawn' : ', which has no pawns'}.`)
    }
  }

  const backRank = move.color === 'w' ? '1' : '8'
  if (['n', 'b'].includes(piece.type) && from[1] === backRank && to[1] !== backRank && Number(move.beforeFen.split(' ')[5]) <= 10) {
    add(50, `The ${names[piece.type]} develops from the back rank.`)
  }

  if (center.includes(to)) {
    add(45, `The ${names[piece.type]} occupies ${to} in the center.`)
  } else {
    const newControl = center.filter(square => after.attackers(square, move.color).includes(to) && !before.isAttacked(square, move.color))
    if (newControl.length) add(40, `The ${names[piece.type]} adds control of ${newControl.slice(0, 2).join(' and ')} in the center.`)
  }

  return candidates.sort((a, b) => b.priority - a.priority).slice(0, 2).map(candidate => candidate.text)
}
