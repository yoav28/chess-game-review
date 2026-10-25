import { terminalEvaluation } from '../engine/protocol'
import type { PositionAnalysis } from '../engine/types'
import { createPosition, moveFromUci, positionMoveUci } from '../lib/position'
import { buildReview, parsePgn } from '../lib/review'

export function reviewFixture(pgn = '[White "Ada"]\n[Black "Grace"]\n\n1. e4 e5 2. Nf3 Nc6 *') {
  const game = parsePgn(pgn)
  const positions = [game.initialFen, ...game.moves.map(move => move.afterFen)].map((fen, index): PositionAnalysis => {
    const board = createPosition(fen, game.variant)
    const terminal = terminalEvaluation(board)
    const next = terminal ? undefined : game.moves[index]?.uci ?? positionMoveUci(board.moves({ verbose: true })[0])
    const san = next ? moveFromUci(board, next).san : null
    const evaluation = terminal ?? { cp: 0, mate: null }
    const pv = next ? [next] : []
    const pvSan = san ? [san] : []
    return { variant: game.variant, fen, evaluation, bestMove: next ?? null, bestMoveSan: san, pv, pvSan, depth: terminal ? 0 : 12,
      lines: terminal ? [] : [{ rank: 1, depth: 12, evaluation, pv, pvSan }] }
  })
  return buildReview(game, positions)
}
