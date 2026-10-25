import { createPosition, moveFromUci, type ChessVariant } from './position'

type Move = { from: string; to: string; kingTo?: string; rookFrom?: string; rookTo?: string }
export function physicalMove(move: Move): { from: string; to: string } {
  if (move.kingTo === move.from && move.rookFrom && move.rookTo) return { from: move.rookFrom, to: move.rookTo }
  return { from: move.from, to: move.kingTo ?? move.to }
}

export function continuationArrows(fen: string, moves: readonly string[], variant?: ChessVariant, limit = 2): { from: string; to: string }[] {
  const arrows: { from: string; to: string }[] = []
  try {
    const board = createPosition(fen, variant)
    for (const uci of moves.slice(0, limit)) {
      if (!/^(?:[a-h][1-8][a-h][1-8][qrbnk]?|[PNBRQ]@[a-h][1-8])$/.test(uci)) break
      const move = moveFromUci(board, uci)
      const arrow = physicalMove(move)
      if (arrow.from !== arrow.to) arrows.push(arrow)
    }
  } catch {}
  return arrows
}

export function bestMoveArrow(fen: string, move?: string | null, variant?: ChessVariant): string | undefined {
  const arrow = move ? continuationArrows(fen, [move], variant, 1)[0] : undefined
  return arrow ? `${arrow.from}${arrow.to}` : undefined
}
