import { createPosition, type ChessPosition, type ChessVariant } from '../lib/position'
import type { AnalysisOptions, EngineLine, Evaluation } from './types'

export function parseInfo(line: string, fen: string, variant?: ChessVariant): EngineLine | null {
  const depth = line.match(/\bdepth (\d+)/)
  const score = line.match(/\bscore (cp|mate) (-?\d+)/)
  const pv = line.match(/\bpv (.+)$/)
  if (!depth || !score || !pv || /\b(?:lowerbound|upperbound)\b/.test(line)) return null
  const direction = fen.split(' ')[1] === 'w' ? 1 : -1
  const rawValue = Number(score[2])
  const value = rawValue * direction
  const evaluation: Evaluation = score[1] === 'cp'
    ? { cp: value, mate: null }
    : { cp: rawValue === 0 ? -100000 * direction : (value > 0 ? 1 : -1) * (100000 - Math.min(Math.abs(value), 999)), mate: value }
  const moves = pv[1].trim().split(/\s+/).filter(move => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
  if (!moves.length) return null
  return {
    rank: Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1),
    depth: Number(depth[1]),
    evaluation,
    pv: moves,
    pvSan: variationToSan(fen, moves, variant),
  }
}

export function completedLines(lines: EngineLine[], candidates: number): EngineLine[] {
  const depths = [...new Set(lines.map(line => line.depth))].sort((a, b) => b - a)
  const atDepth = (depth: number) => lines.filter(line => line.depth === depth).sort((a, b) => a.rank - b.rank)
  const complete = depths.find(depth => {
    const batch = atDepth(depth)
    return Array.from({ length: candidates }, (_, index) => index + 1).every(rank => batch.some(line => line.rank === rank))
  })
  if (complete !== undefined) return atDepth(complete)
  const partial = depths.find(depth => lines.some(line => line.depth === depth && line.rank === 1))
  return partial === undefined ? [] : atDepth(partial)
}

export function boardWithHistory(fen: string, history?: AnalysisOptions['history'], variant?: ChessVariant): ChessPosition {
  if (!history) return createPosition(fen, variant)
  const board = createPosition(history.initialFen, variant)
  for (const uci of history.moves) {
    board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  }
  if (board.fen() !== createPosition(fen, variant).fen()) throw new Error('The supplied move history does not match this position.')
  return board
}

export function variationToSan(fen: string, moves: string[], variant?: ChessVariant): string[] {
  const board = createPosition(fen, variant)
  const san: string[] = []
  for (const move of moves) {
    try {
      const played = board.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
      san.push(played.san)
    } catch {
      break
    }
  }
  return san
}

export function terminalEvaluation(board: ChessPosition): Evaluation | null {
  if (board.isCheckmate()) return { cp: board.turn() === 'w' ? -100000 : 100000, mate: 0 }
  if (board.isDraw()) return { cp: 0, mate: null }
  return null
}
