import type { Color, PieceSymbol, Square } from 'chess.js'
import { createPosition } from './position'
import { insightsForMove } from './insights'
import type { GamePhase, GameReview, MoveReview, ParsedMove } from './review'

export type TrainingTheme = 'loose-pieces' | 'fork' | 'pin' | 'mate' | 'development' | 'castling' | 'calculation'

export type TrainingExercise = {
  ply: number
  moveLabel: string
  phase: GamePhase
  theme: TrainingTheme
  title: string
  evidence: string
  goal: string
  hint: string
  centipawnLoss: number
  winningChanceLoss?: number
  lossText: string
}

export const trainingMethod = 'Exercises come from this game’s reviewed errors, ordered by winning-chance loss when available; older reviews use centipawn loss. Themes describe legal moves and board patterns; they do not prove that a tactic wins material. The engine’s preferred move is the drill solution at the review depth.'

const names: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const errors = new Set(['inaccuracy', 'mistake', 'blunder', 'missed'])
const chanceLoss = (move: MoveReview): number | undefined => typeof move.winningChanceLoss === 'number' && Number.isFinite(move.winningChanceLoss) && move.winningChanceLoss >= 0 && move.winningChanceLoss <= 100 ? move.winningChanceLoss : undefined
const rankLoss = (move: MoveReview): number => chanceLoss(move) ?? move.centipawnLoss / 100
const lossDescription = (move: MoveReview): string => chanceLoss(move) !== undefined ? `${chanceLoss(move)!.toFixed(1)} winning-chance points` : `${(move.centipawnLoss / 100).toFixed(2)} pawns of engine evaluation`

function alternative(move: MoveReview): ParsedMove | null {
  if (!move.bestMove || move.bestMove === move.uci) return null
  try {
    const board = createPosition(move.beforeFen, move.variant)
    const played = board.move({ from: move.bestMove.slice(0, 2), to: move.bestMove.slice(2, 4), promotion: move.bestMove[4] })
    return {
      ...move, san: played.san, uci: move.bestMove, afterFen: board.fen(),
      from: played.from, to: played.to, piece: played.piece, captured: played.captured, promotion: played.promotion,
      kingTo: played.kingTo, rookFrom: played.rookFrom, rookTo: played.rookTo,
    }
  } catch {
    return null
  }
}

function loosePiece(move: MoveReview): string | null {
  const board = createPosition(move.afterFen, move.variant)
  const captures = board.moves({ verbose: true }).filter(reply => reply.captured)
  for (const reply of captures) {
    const targetSquare = reply.flags.includes('e') ? `${reply.to[0]}${reply.from[1]}` as Square : reply.to
    const target = board.get(targetSquare)
    if (target?.color === move.color && !board.attackers(targetSquare, move.color).length) {
      return `After ${move.san}, the ${names[target.type]} on ${targetSquare} has no direct defender and ${reply.san} is a legal capture.`
    }
  }
  return null
}

function themeFor(move: MoveReview, best: ParsedMove): Pick<TrainingExercise, 'theme' | 'title' | 'evidence' | 'goal'> {
  const bestBoard = createPosition(best.afterFen, best.variant)
  if (bestBoard.isCheckmate()) return {
    theme: 'mate', title: 'Finish the mating attack', evidence: 'The engine alternative delivers immediate checkmate.',
    goal: 'Find a move that leaves the opponent in check with no legal escape.',
  }
  const direction = move.color === 'w' ? 1 : -1
  if (move.beforeEvaluation.mate !== null && move.beforeEvaluation.mate * direction > 0) return {
    theme: 'mate', title: 'Keep the mating sequence', evidence: `The review found a forced mate in ${Math.abs(move.beforeEvaluation.mate)} before this move.`,
    goal: 'Compare forcing checks and find the engine’s preferred continuation of the mating attack.',
  }
  const loose = loosePiece(move)
  if (loose) return {
    theme: 'loose-pieces', title: 'Check loose pieces', evidence: loose,
    goal: 'Before moving, check the opponent’s legal captures and find the engine’s preferred alternative.',
  }
  const insights = insightsForMove(best)
  const fork = insights.find(text => text.includes('fork pressure'))
  if (fork) return { theme: 'fork', title: 'Find a double attack', evidence: `In the engine alternative: ${fork}`, goal: 'Look for one piece attacking two valuable targets; calculate the opponent’s replies.' }
  const pin = insights.find(text => text.includes('pins the'))
  if (pin) return { theme: 'pin', title: 'Use a pin', evidence: `In the engine alternative: ${pin}`, goal: 'Find a move that lines up a sliding piece, an enemy piece, and the enemy king.' }
  if (best.san.startsWith('O-O')) return {
    theme: 'castling', title: 'Consider castling', evidence: 'Castling was legal in this position and was the engine’s first choice.',
    goal: 'Check whether the king can castle and compare that option with checks, captures, and threats.',
  }
  const development = insights.find(text => text.includes('develops from the back rank'))
  if (development) return {
    theme: 'development', title: 'Bring a minor piece into play', evidence: `In the engine alternative: ${development}`,
    goal: 'Compare legal developing moves with forcing moves before choosing the engine’s preferred move.',
  }
  return {
    theme: 'calculation', title: `Revisit this ${move.phase} decision`,
    evidence: `${move.san} lost ${lossDescription(move)} at depth ${move.depth}.`,
    goal: 'List checks, captures, and threats for both sides, then find the engine’s preferred move.',
  }
}

export function trainingPlan(review: Pick<GameReview, 'moves'>, color: Color): TrainingExercise[] {
  return review.moves
    .filter(move => move.color === color && errors.has(move.classification) && (chanceLoss(move) !== undefined ? chanceLoss(move)! > 0 : move.centipawnLoss > 60))
    .sort((a, b) => rankLoss(b) - rankLoss(a) || a.ply - b.ply)
    .flatMap(move => {
      const best = alternative(move)
      if (!best) return []
      const piece = createPosition(move.beforeFen, move.variant).get(best.from as Square)
      if (!piece) return []
      return [{
        ...themeFor(move, best), ply: move.ply, phase: move.phase, centipawnLoss: move.centipawnLoss,
        winningChanceLoss: chanceLoss(move), lossText: `−${lossDescription(move)}`,
        moveLabel: `${move.beforeFen.split(' ')[5]}${color === 'w' ? '.' : '...'} ${move.san}`,
        hint: `Consider moves by the ${names[piece.type]} on ${best.from}.`,
      }]
    })
    .slice(0, 3)
}
