export type ChessVariant = 'chess' | 'chess960' | 'threecheck' | 'kingofthehill' | 'atomic' | 'horde' | 'crazyhouse' | 'giveaway' | 'racingkings'
export const threeCheckInitialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 +0+0'

export function pgnVariant(pgn: string): ChessVariant {
  const variant = pgn.match(/^\s*\[Variant\s+"([^"\r\n]+)"\]/im)?.[1]
  if (!variant || /^(Standard|Chess|From Position)$/i.test(variant)) return 'chess'
  if (/^(Chess960|Fischerandom|Fischer Random|Freestyle)$/i.test(variant)) return 'chess960'
  if (/^(3-?check|Three-?check|Three Check)$/i.test(variant)) return 'threecheck'
  if (/^(King of the Hill|KingOfTheHill|KOTH)$/i.test(variant)) return 'kingofthehill'
  if (/^Atomic$/i.test(variant)) return 'atomic'
  if (/^Horde$/i.test(variant)) return 'horde'
  if (/^Crazyhouse$/i.test(variant)) return 'crazyhouse'
  if (/^Giveaway$/i.test(variant)) return 'giveaway'
  if (/^(?:Racing Kings|RacingKings)$/i.test(variant)) return 'racingkings'
  throw new Error(`The ${variant} variant is not supported. Review supports standard chess, Chess960, three-check, King of the Hill, Atomic, Horde, Crazyhouse, Giveaway, and Racing Kings.`)
}

export const variantLabel = (variant?: ChessVariant) => variant === 'threecheck' ? 'Three-check' : variant === 'chess960' ? 'Chess960' : variant === 'kingofthehill' ? 'King of the Hill' : variant === 'atomic' ? 'Atomic' : variant === 'horde' ? 'Horde' : variant === 'crazyhouse' ? 'Crazyhouse' : variant === 'giveaway' ? 'Giveaway' : variant === 'racingkings' ? 'Racing Kings' : 'Standard chess'
export const usesVariantEngine = (variant: ChessVariant) => variant === 'threecheck' || variant === 'kingofthehill' || variant === 'atomic' || variant === 'horde' || variant === 'crazyhouse' || variant === 'giveaway' || variant === 'racingkings'
export const fairyVariantName = (variant: ChessVariant) => variant === 'threecheck' ? '3check' : variant === 'kingofthehill' ? 'kingofthehill' : variant === 'atomic' ? 'atomic' : variant === 'horde' ? 'horde' : variant === 'crazyhouse' ? 'crazyhouse' : variant === 'giveaway' ? 'antichess' : variant === 'racingkings' ? 'racingkings' : undefined
export const isVariantHeuristic = usesVariantEngine
