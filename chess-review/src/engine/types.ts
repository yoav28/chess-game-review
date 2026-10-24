import type { ChessVariant } from '../lib/position'

export type Evaluation = { cp: number; mate: number | null }

export type EngineLine = {
  rank: number
  depth: number
  evaluation: Evaluation
  pv: string[]
  pvSan: string[]
}

export type PositionAnalysis = {
  variant?: ChessVariant
  fen: string
  evaluation: Evaluation
  bestMove: string | null
  bestMoveSan: string | null
  pv: string[]
  pvSan: string[]
  depth: number
  lines: EngineLine[]
}

export type AnalysisOptions = {
  limit?: 'depth-and-time' | 'time' | 'continuous'
  threads?: number
  onUpdate?: (analysis: PositionAnalysis) => void
  variant?: ChessVariant
  depth?: number
  timeMs?: number
  multiPv?: number
  signal?: AbortSignal
  history?: { initialFen: string; moves: string[] }
}

export type ReviewProgress = {
  completed: number
  total: number
  percent: number
}

export type ReviewOptions = Omit<AnalysisOptions, 'limit' | 'onUpdate'> & {
  onProgress?: (progress: ReviewProgress) => void
}
