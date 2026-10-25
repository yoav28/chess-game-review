import { Chess, type Color } from 'chess.js'
import { parsePgn } from './game'
import { classificationLabels, type GameReview, type MoveReview } from './review'
import type { Evaluation } from '../engine/types'
import { createPosition, moveFromUci, pgnVariant, type ChessPosition } from './position'
import { reviewedVariantPgn } from './reviewed-variant-pgn'

export type SkillScore = { accuracy: number | null; moves: number }
export type SkillSummary = {
  key: 'opening' | 'tactics' | 'strategy' | 'endgame'
  label: string
  description: string
  white: SkillScore
  black: SkillScore
}

const skillMethod = 'Category scores average this review’s move accuracy, not a player rating. Opening and Endgame use the recorded game phase. Tactics includes captures, checks, and promotions. Strategy includes quiet middlegame moves. Categories can overlap; no eligible moves means unavailable. This move-based heuristic does not measure every aspect of chess skill.'
const forcing = (move: MoveReview) => Boolean(move.captured || move.promotion || /[+#]$/.test(move.san))

function skillScore(moves: MoveReview[], color: Color): SkillScore {
  const eligible = moves.filter(move => move.color === color)
  return {
    accuracy: eligible.length ? Math.round(eligible.reduce((sum, move) => sum + move.accuracy, 0) / eligible.length * 10) / 10 : null,
    moves: eligible.length,
  }
}

export function skillSummaries(review: GameReview): { categories: SkillSummary[]; method: string } {
  const groups: { key: SkillSummary['key']; label: string; description: string; include: (move: MoveReview) => boolean }[] = [
    { key: 'opening', label: 'Opening', description: 'Moves in the opening phase.', include: move => move.phase === 'opening' },
    { key: 'tactics', label: 'Tactics', description: 'Captures, checks, and promotions in any phase.', include: forcing },
    { key: 'strategy', label: 'Strategy', description: 'Middlegame moves without a capture, check, or promotion.', include: move => move.phase === 'middlegame' && !forcing(move) },
    { key: 'endgame', label: 'Endgame', description: 'Moves in the endgame phase.', include: move => move.phase === 'endgame' },
  ]
  return {
    categories: groups.map(({ key, label, description, include }) => {
      const moves = review.moves.filter(include)
      return { key, label, description, white: skillScore(moves, 'w'), black: skillScore(moves, 'b') }
    }),
    method: skillMethod,
  }
}

function evaluationTag(evaluation: Evaluation): string {
  if (evaluation.mate === 0) return evaluation.cp < 0 ? '#-0' : '#0'
  return evaluation.mate !== null ? `#${evaluation.mate}` : (evaluation.cp / 100).toFixed(2)
}

function clockTag(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000)
  const hours = Math.floor(milliseconds / 3600000)
  const minutes = Math.floor(milliseconds / 60000) % 60
  const remainder = milliseconds % 60000
  const whole = String(Math.floor(remainder / 1000)).padStart(2, '0')
  const fraction = remainder % 1000 ? `.${String(remainder % 1000).padStart(3, '0').replace(/0+$/, '')}` : ''
  return `[%clk ${hours}:${String(minutes).padStart(2, '0')}:${whole}${fraction}]`
}

function replay(review: GameReview): ChessPosition {
  const board = createPosition(review.initialFen, review.variant ?? pgnVariant(review.pgn))
  for (const move of review.moves) {
    if (board.fen() !== move.beforeFen) throw new Error('The review contains an inconsistent move sequence.')
    moveFromUci(board, move.uci)
    if (board.fen() !== move.afterFen) throw new Error('The review contains an inconsistent position.')
  }
  return board
}

function gameResult(review: GameReview, board: ChessPosition): string {
  const outcome = board.variantOutcome?.()
  if (outcome) return outcome.winner === 'w' ? '1-0' : outcome.winner === 'b' ? '0-1' : '1/2-1/2'
  if (board.isCheckmate()) return board.turn() === 'w' ? '0-1' : '1-0'
  if (/^(?:1-0|0-1|1\/2-1\/2)$/.test(review.result)) return review.result
  if (board.isStalemate() || board.isInsufficientMaterial()) return '1/2-1/2'
  return '*'
}

function safeComment(comment: string): string {
  return comment.replace(/[{}]/g, character => character === '{' ? '(' : ')').replace(/\s+/g, ' ').trim()
}

function safeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')
}

export function reviewedPgn(review: GameReview): string {
  const final = replay(review)
  if ((review.variant ?? pgnVariant(review.pgn)) !== 'chess') return reviewedVariantPgn(review, gameResult(review, final), skillMethod, evaluationTag, clockTag)
  const source = new Chess()
  source.loadPgn(review.pgn)
  const comments = new Map(source.getComments().map(comment => [comment.fen, comment.comment]))
  const clocks = parsePgn(review.pgn).clocks
  const board = new Chess(review.initialFen)
  for (const [key, value] of Object.entries(review.headers)) {
    if (key !== 'FEN' && key !== 'SetUp') board.setHeader(key, safeHeader(value))
  }
  board.setHeader('White', safeHeader(review.white))
  board.setHeader('Black', safeHeader(review.black))
  board.setHeader('Result', gameResult(review, final))
  board.setHeader('Annotator', safeHeader(`Open File / ${review.engine}`))
  board.setComment(safeComment(`${comments.get(review.initialFen) ?? ''} ${review.accuracyModel} ${skillMethod}`))
  review.moves.forEach((move, index) => {
    moveFromUci(board, move.uci)
    const original = (comments.get(board.fen()) ?? '').replace(/\[%(?:eval|clk)\s+[^\]]*\]/gi, '').trim()
    const clock = clocks[index] !== null && clocks[index] !== undefined ? clockTag(clocks[index]) : ''
    board.setComment(safeComment([
      original, clock, `${classificationLabels[move.classification]}.`, `[%eval ${evaluationTag(move.evaluation)}]`,
      `Accuracy ${move.accuracy.toFixed(1)}; depth ${move.depth}.`,
      move.bestMoveSan ? `Best move: ${move.bestMoveSan}.` : '', move.explanation,
    ].filter(Boolean).join(' ')))
  })
  return board.pgn({ maxWidth: 100 })
}

const scoreText = (score: SkillScore) => `${score.accuracy === null ? 'unavailable' : `${score.accuracy.toFixed(1)}%`} (${score.moves} ${score.moves === 1 ? 'move' : 'moves'})`

export function plainTextReport(review: GameReview): string {
  const summary = skillSummaries(review)
  const lines = [
    `Open File game review: ${review.white} vs ${review.black}`,
    `Result: ${gameResult(review, replay(review))}`,
    `Engine: ${review.engine}`,
    `White accuracy: ${review.whiteAccuracy === null ? 'unavailable' : `${review.whiteAccuracy.toFixed(1)}%`}`,
    `Black accuracy: ${review.blackAccuracy === null ? 'unavailable' : `${review.blackAccuracy.toFixed(1)}%`}`,
    ...(review.opening ? [`Opening: ${review.opening.name} (${review.opening.eco})`] : []),
    '', 'Category performance:',
    ...summary.categories.map(category => `${category.label}: White ${scoreText(category.white)}; Black ${scoreText(category.black)}`),
    '', 'Key moments:',
    ...review.keyMoments.flatMap(ply => {
      const move = review.moves.find(candidate => candidate.ply === ply)
      return move ? [`${move.beforeFen.split(' ')[5]}${move.color === 'w' ? '.' : '...'} ${move.san} — ${classificationLabels[move.classification]}. ${move.explanation}`] : []
    }),
    ...(review.keyMoments.length ? [] : ['No moves exceeded the key-moment threshold in this analysis.']),
    '', 'Method:', review.accuracyModel, summary.method,
  ]
  return lines.join('\n')
}
