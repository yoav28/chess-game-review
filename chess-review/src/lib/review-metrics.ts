import type { Color } from 'chess.js'
import { createPosition, type ChessVariant } from './position'
import type { PositionAnalysis } from '../engine/types'
import type { ParsedMove } from './review'

const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

function material(fen: string, color: Color, variant?: ChessVariant): number {
  return createPosition(fen, variant).board().flat().reduce((total, piece) => piece
    ? total + (piece.color === color ? 1 : -1) * values[piece.type] : total, 0)
}

export function isSoundSacrifice(move: ParsedMove, before: PositionAnalysis, after: PositionAnalysis): boolean {
  if (before.depth < 12 || after.depth < 12 || before.bestMove !== move.uci || !after.pv.length) return false
  const direction = move.color === 'w' ? 1 : -1
  if (after.evaluation.cp * direction < 50) return false
  const board = createPosition(move.afterFen, move.variant)
  const replyUci = after.pv[0]
  try {
    const reply = board.move({ from: replyUci.slice(0, 2), to: replyUci.slice(2, 4), promotion: replyUci[4] })
    if (reply.to !== move.to || !reply.captured || values[reply.captured] < 3) return false
    return material(board.fen(), move.color, move.variant) <= material(move.beforeFen, move.color, move.variant) - 2
  } catch {
    return false
  }
}

export function isUniqueOpportunity(move: ParsedMove, before: PositionAnalysis): boolean {
  const alternative = before.lines.find(line => line.rank === 2)
  if (!alternative || before.depth < 12 || alternative.depth < 12 || before.bestMove !== move.uci) return false
  const direction = move.color === 'w' ? 1 : -1
  const bestScore = before.evaluation.cp * direction
  const nextScore = alternative.evaluation.cp * direction
  return (bestScore >= -50 && nextScore <= -200) || (bestScore >= 200 && nextScore <= 50)
}
