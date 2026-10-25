import type { GameReview } from './review'
import { createPosition, positionMoveUci } from './position'

export function embedPuzzleData(review: GameReview, start: number) {
  if (!Number.isInteger(start) || start < 0) throw new Error('Choose a valid puzzle starting position.')
  const fen = start ? review.moves[start - 1]?.afterFen : review.initialFen
  if (!fen || start >= review.moves.length) throw new Error('Choose a position before the final move to create a puzzle.')
  const side = createPosition(fen, review.variant).turn()
  const turns = review.moves.map((record, index) => {
    if (index < start || record.color !== side) return []
    const board = createPosition(record.beforeFen, review.variant)
    const choices = board.moves({ verbose: true }).map(move => ({
      uci: positionMoveUci(move), from: move.from, to: move.kingTo ?? move.to,
      rookFrom: move.rookFrom, promotion: move.promotion, drop: move.drop, san: move.san, fen: move.after,
      pockets: createPosition(move.after, review.variant).pockets?.() ?? null,
    }))
    if (!choices.some(move => move.uci === record.uci)) throw new Error('The puzzle contains an invalid recorded move.')
    return choices
  })
  return { start, side, turns, expected: review.moves.map(move => move.uci) }
}
