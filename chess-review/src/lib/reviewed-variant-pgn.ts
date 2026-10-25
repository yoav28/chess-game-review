import { makePgn, parsePgn as parseTree } from 'chessops/pgn'
import { parsePgn } from './game'
import { pgnVariant } from './variants'
import { classificationLabels, type GameReview } from './review'
import type { Evaluation } from '../engine/types'

const safeComment = (value: string) => value.replace(/[{}]/g, character => character === '{' ? '(' : ')').replace(/\s+/g, ' ').trim()

export function reviewedVariantPgn(review: GameReview, result: string, method: string, evaluationTag: (evaluation: Evaluation) => string, clockTag: (seconds: number) => string): string {
  const variant = review.variant ?? pgnVariant(review.pgn)
  const source = parsePgn(review.pgn, variant)
  const trees = parseTree(review.pgn)
  if (trees.length !== 1 || source.moves.length !== review.moves.length) throw new Error('The source variant PGN does not match this review.')
  const tree = trees[0]
  for (const [key, value] of Object.entries(review.headers)) {
    if (!/^\w+$/.test(key)) throw new Error('The review contains an invalid PGN header.')
    tree.headers.set(key, value.replace(/[\r\n]/g, ' '))
  }
  tree.headers.set('Variant', variant === 'threecheck' ? '3-check' : variant === 'kingofthehill' ? 'King of the Hill' : variant === 'atomic' ? 'Atomic' : 'Chess960')
  tree.headers.set('SetUp', '1')
  tree.headers.set('FEN', review.initialFen)
  tree.headers.set('White', review.white.replace(/[\r\n]/g, ' '))
  tree.headers.set('Black', review.black.replace(/[\r\n]/g, ' '))
  tree.headers.set('Result', result)
  tree.headers.set('Annotator', `Open File / ${review.engine}`.replace(/[\r\n]/g, ' '))
  tree.comments = [...(tree.comments ?? []), safeComment(`${review.accuracyModel} ${method}`)]
  const nodes = [...tree.moves.mainlineNodes()]
  if (nodes.length !== review.moves.length) throw new Error('The source variant mainline is incomplete.')
  nodes.forEach((node, index) => {
    const move = review.moves[index]
    if (source.moves[index].uci !== move.uci) throw new Error('The source variant moves do not match this review.')
    const original = (node.data.comments ?? []).map(comment => comment.replace(/\[%(?:eval|clk)\s+[^\]]*\]/gi, '').trim()).filter(Boolean)
    const clock = source.clocks[index]
    node.data.san = move.san
    node.data.comments = [safeComment([
      ...original, clock !== null && clock !== undefined ? clockTag(clock) : '',
      `${classificationLabels[move.classification]}.`, `[%eval ${evaluationTag(move.evaluation)}]`,
      `Accuracy ${move.accuracy.toFixed(1)}; depth ${move.depth}.`,
      move.bestMoveSan ? `Best move: ${move.bestMoveSan}.` : '', move.explanation,
    ].filter(Boolean).join(' '))]
  })
  return makePgn(tree)
}
