import { completedLines } from './protocol'
import type { ChessVariant } from '../lib/position'
import type { EngineLine, PositionAnalysis } from './types'

export function searchResult(fen: string, variant: ChessVariant, records: EngineLine[], candidates: number): PositionAnalysis | null {
  const completed = completedLines(records.filter(line => line.pv.length > 0 && line.pv.length === line.pvSan.length), candidates)
  const seen = new Set<string>()
  const lines = completed.filter(line => {
    const first = line.pv[0]
    if (!first || seen.has(first)) return false
    seen.add(first)
    return true
  })
  const primary = lines.find(line => line.rank === 1)
  if (!primary?.pv[0] || !primary.pvSan[0]) return null
  return { fen, variant, evaluation: primary.evaluation, bestMove: primary.pv[0], bestMoveSan: primary.pvSan[0], pv: primary.pv, pvSan: primary.pvSan, depth: primary.depth, lines }
}
