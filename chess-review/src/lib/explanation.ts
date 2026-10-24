import { createPosition, positionMoveUci, type ChessPosition, type ChessVariant, type PositionMove } from './position'
import type { MoveReview, ParsedMove } from './review'
import { insightsForMove } from './insights'

export type ExplanationStep = {
  fen: string
  san: string
  uci?: string
  kingTo?: string
  caption: string
  heading: string
  stage: 'position' | 'played' | 'alternative' | 'continuation'
}

function applyMove(board: ChessPosition, uci: string): PositionMove {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('The explanation contains an invalid move.')
  return board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
}

function describeMove(move: PositionMove, legalMoves: number, ply: number, variant?: ChessVariant): string {
  const parsed: ParsedMove = {
    variant, ply, san: move.san, uci: positionMoveUci(move),
    beforeFen: move.before, afterFen: move.after, color: move.color,
    piece: move.piece, captured: move.captured, promotion: move.promotion,
    from: move.from, to: move.to, legalMoves,
  }
  const names: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
  let action = `${move.color === 'w' ? 'White' : 'Black'} plays ${move.san}.`
  if (move.captured) action += ` The ${names[move.piece]} captures ${move.captured === 'p' ? 'a pawn' : `the ${names[move.captured]}`} on ${move.to}.`
  if (move.promotion) action += ` The pawn promotes to a ${names[move.promotion]}.`
  if (createPosition(move.after, variant).isCheckmate()) action += ' This is checkmate.'
  else if (move.san.endsWith('+')) action += ' This gives check.'
  const concepts = insightsForMove(parsed)
  return `${action}${concepts.length ? ` ${concepts.join(' ')}` : ''}`
}

export function buildExplanationSteps(review: MoveReview): ExplanationStep[] {
  const board = createPosition(review.beforeFen, review.variant)
  const beforeFen = board.fen()
  const played = applyMove(board, review.uci)
  const alternative = review.bestMove !== null && review.bestMove !== review.uci
  const steps: ExplanationStep[] = [{
    fen: beforeFen, san: '', stage: 'position', heading: 'Before the move',
    caption: `${review.color === 'w' ? 'White' : 'Black'} to move. First, see the move played in the game.`,
  }, {
    fen: board.fen(), san: played.san, uci: review.uci, kingTo: played.kingTo, stage: 'played', heading: 'Played in the game',
    caption: `${played.san} was played. ${review.explanation}`,
  }]
  if (!review.bestMove) return steps

  const variation = createPosition(beforeFen, review.variant)
  let best: PositionMove
  try {
    best = applyMove(variation, review.bestMove)
  } catch {
    return steps
  }
  if (alternative) {
    steps.push({
      fen: beforeFen, san: '', stage: 'alternative', heading: 'Compare the engine choice',
      caption: `Return to the position before ${played.san}. The engine preferred ${best.san} at depth ${review.depth}.`,
    }, {
      fen: variation.fen(), san: best.san, uci: review.bestMove, kingTo: best.kingTo, stage: 'continuation', heading: 'Engine choice',
      caption: describeMove(best, createPosition(beforeFen, review.variant).moves().length, review.ply, review.variant),
    })
  }
  if (review.pv[0] !== review.bestMove) return steps
  for (const [index, uci] of review.pv.slice(1, 8).entries()) {
    try {
      const legalMoves = variation.moves().length
      const move = applyMove(variation, uci)
      steps.push({
        fen: variation.fen(), san: move.san, uci, kingTo: move.kingTo, stage: 'continuation', heading: 'Engine continuation',
        caption: describeMove(move, legalMoves, review.ply + index + 1, review.variant),
      })
    } catch {
      break
    }
  }
  return steps
}
