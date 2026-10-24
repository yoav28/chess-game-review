import type { Color } from 'chess.js'
import { analyzePosition } from '../engine/stockfish'
import type { AnalysisOptions, Evaluation, PositionAnalysis } from '../engine/types'
import { physicalMove } from './board-visuals'
import { createPosition, positionMoveUci, resolveVariant, type ChessVariant } from './position'

export type ThreatPosition = { eligible: false; reason: string } | {
  eligible: true
  reason: ''
  sourceFen: string
  hypotheticalFen: string
  variant: ChessVariant
  color: Color
}
export type ThreatResult = {
  sourceFen: string
  hypotheticalFen: string
  variant: ChessVariant
  color: Color
  depth: number
  evaluation: Evaluation
  pv: string[]
  pvSan: string[]
  firstMove: { uci: string; san: string } | null
  arrow: { from: string; to: string } | null
}

export function threatPosition(fen: string, variant?: ChessVariant): ThreatPosition {
  try {
    const rules = resolveVariant(fen, variant)
    const board = createPosition(fen, rules)
    if (board.isGameOver()) return { eligible: false, reason: 'Threat analysis is unavailable after the position has ended.' }
    if (board.isCheck()) return { eligible: false, reason: 'Threat analysis is unavailable while the side to move is in check.' }
    const sourceFen = board.fen()
    const fields = sourceFen.split(' ')
    fields[1] = board.turn() === 'w' ? 'b' : 'w'
    fields[3] = '-'
    const opponent = createPosition(fields.join(' '), rules)
    if (opponent.isCheck()) return { eligible: false, reason: 'The hypothetical opponent-to-move position is already in check.' }
    if (opponent.isGameOver()) return { eligible: false, reason: 'The hypothetical opponent-to-move position has ended.' }
    return { eligible: true, reason: '', sourceFen, hypotheticalFen: opponent.fen(), variant: rules, color: opponent.turn() }
  } catch {
    return { eligible: false, reason: 'Select a valid position for threat analysis.' }
  }
}

export function verifiedThreat(position: Extract<ThreatPosition, { eligible: true }>, analysis: PositionAnalysis): ThreatResult {
  if (analysis.fen !== position.hypotheticalFen || (analysis.variant ?? 'chess') !== position.variant) throw new Error('The engine returned threat analysis for a different position or variant.')
  if (!Number.isFinite(analysis.evaluation.cp) || analysis.evaluation.mate !== null && !Number.isFinite(analysis.evaluation.mate)
    || !Number.isInteger(analysis.depth) || analysis.depth < 0 || !Array.isArray(analysis.pv)) throw new Error('The engine returned incomplete threat analysis. Try again.')
  const board = createPosition(position.hypotheticalFen, position.variant)
  const pv: string[] = []
  const pvSan: string[] = []
  let arrow: ThreatResult['arrow'] = null
  if (analysis.pv.length && analysis.bestMove !== analysis.pv[0]) throw new Error('The engine returned an inconsistent threat continuation. Try again.')
  for (const uci of analysis.pv.slice(0, 8)) {
    try {
      if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid move')
      const move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      if (!pv.length) {
        const physical = physicalMove(move)
        if (physical.from !== physical.to) arrow = physical
      }
      pv.push(positionMoveUci(move))
      pvSan.push(move.san)
    } catch {
      if (!pv.length) throw new Error('The engine did not return a legal hypothetical opponent move. Try again.')
      break
    }
  }
  return {
    sourceFen: position.sourceFen, hypotheticalFen: position.hypotheticalFen,
    variant: position.variant, color: position.color, depth: analysis.depth, evaluation: { ...analysis.evaluation },
    pv, pvSan, firstMove: pv.length ? { uci: pv[0], san: pvSan[0] } : null, arrow,
  }
}

export async function analyzeThreat(fen: string, options: AnalysisOptions = {}, analyze = analyzePosition): Promise<ThreatResult> {
  if (options.signal?.aborted) throw new DOMException('Threat analysis cancelled.', 'AbortError')
  const position = threatPosition(fen, options.variant)
  if (!position.eligible) throw new Error(position.reason)
  const analysis = await analyze(position.hypotheticalFen, {
    depth: options.depth, timeMs: options.timeMs, signal: options.signal, variant: position.variant, multiPv: 1,
  })
  if (options.signal?.aborted) throw new DOMException('Threat analysis cancelled.', 'AbortError')
  return verifiedThreat(position, analysis)
}
