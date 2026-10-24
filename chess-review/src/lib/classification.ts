import type { Classification } from './review'

export const classificationGlyph: Record<Classification, string> = {
  brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '•', book: '▤',
  inaccuracy: '?!', mistake: '?', blunder: '??', missed: '×', forced: '→',
}
