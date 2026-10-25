export type ChessVariant = 'chess' | 'chess960' | 'threecheck' | 'kingofthehill' | 'atomic' | 'horde'
export const threeCheckInitialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 +0+0'

export function pgnVariant(pgn: string): ChessVariant {
  const variant = pgn.match(/^\s*\[Variant\s+"([^"\r\n]+)"\]/im)?.[1]
  if (!variant || /^(Standard|Chess|From Position)$/i.test(variant)) return 'chess'
  if (/^(Chess960|Fischerandom|Fischer Random|Freestyle)$/i.test(variant)) return 'chess960'
  if (/^(3-?check|Three-?check|Three Check)$/i.test(variant)) return 'threecheck'
  if (/^(King of the Hill|KingOfTheHill|KOTH)$/i.test(variant)) return 'kingofthehill'
  if (/^Atomic$/i.test(variant)) return 'atomic'
  if (/^Horde$/i.test(variant)) return 'horde'
  throw new Error(`The ${variant} variant is not supported. Review supports standard chess, Chess960, three-check, King of the Hill, Atomic, and Horde.`)
}

export const variantLabel = (variant?: ChessVariant) => variant === 'threecheck' ? 'Three-check' : variant === 'chess960' ? 'Chess960' : variant === 'kingofthehill' ? 'King of the Hill' : variant === 'atomic' ? 'Atomic' : variant === 'horde' ? 'Horde' : 'Standard chess'
export const usesVariantEngine = (variant: ChessVariant) => variant === 'threecheck' || variant === 'kingofthehill' || variant === 'atomic' || variant === 'horde'
export const fairyVariantName = (variant: ChessVariant) => variant === 'threecheck' ? '3check' : variant === 'kingofthehill' ? 'kingofthehill' : variant === 'atomic' ? 'atomic' : variant === 'horde' ? 'horde' : undefined
export const isVariantHeuristic = usesVariantEngine
