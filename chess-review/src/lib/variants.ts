export type ChessVariant = 'chess' | 'chess960' | 'threecheck' | 'kingofthehill'
export const threeCheckInitialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 +0+0'

export function pgnVariant(pgn: string): ChessVariant {
  const variant = pgn.match(/^\s*\[Variant\s+"([^"\r\n]+)"\]/im)?.[1]
  if (!variant || /^(Standard|Chess|From Position)$/i.test(variant)) return 'chess'
  if (/^(Chess960|Fischerandom|Fischer Random|Freestyle)$/i.test(variant)) return 'chess960'
  if (/^(3-?check|Three-?check|Three Check)$/i.test(variant)) return 'threecheck'
  if (/^(King of the Hill|KingOfTheHill|KOTH)$/i.test(variant)) return 'kingofthehill'
  throw new Error(`The ${variant} variant is not supported. Review supports standard chess, Chess960, three-check, and King of the Hill.`)
}

export const variantLabel = (variant?: ChessVariant) => variant === 'threecheck' ? 'Three-check' : variant === 'chess960' ? 'Chess960' : variant === 'kingofthehill' ? 'King of the Hill' : 'Standard chess'
export const usesVariantEngine = (variant: ChessVariant) => variant === 'threecheck' || variant === 'kingofthehill'
export const isVariantHeuristic = usesVariantEngine
