import { analyzePosition } from '../engine/stockfish'
import { analyzeThreat, type ThreatResult } from './threat-analysis'
import type { ChessVariant } from './position'

export type ThreatContext = { fen: string; variant?: ChessVariant; enabled: boolean; depth: number; timeMs: number }
export type ThreatState = { active: boolean; running: boolean; result: ThreatResult | null; error: string }
export const initialThreatState: ThreatState = { active: false, running: false, result: null, error: '' }

export function createThreatSession(onChange: (state: ThreatState) => void, initial: ThreatContext, analyze = analyzePosition) {
  let context = { ...initial }
  let state = { ...initialThreatState }
  let live = true
  let request: AbortController | null = null
  const emit = () => { if (live) onChange(state) }
  const cancel = () => { request?.abort(); request = null }
  function hide() {
    cancel()
    state = { ...initialThreatState }
    emit()
  }
  async function show() {
    if (!live || !context.enabled) return
    cancel()
    const target = { ...context }
    const controller = new AbortController()
    request = controller
    const owns = () => live && context.enabled && request === controller && !controller.signal.aborted && context.fen === target.fen && context.variant === target.variant
    state = { active: true, running: true, result: null, error: '' }
    emit()
    try {
      const result = await analyzeThreat(target.fen, { depth: target.depth, timeMs: target.timeMs, variant: target.variant, signal: controller.signal }, analyze)
      if (owns()) { state = { ...state, result }; emit() }
    } catch (error) {
      if (owns()) { state = { ...state, error: error instanceof Error ? error.message : 'Threat analysis failed. Try again.' }; emit() }
    } finally {
      if (owns()) {
        request = null
        state = { ...state, running: false }
        emit()
      }
    }
  }
  return {
    show, hide,
    configure: (next: ThreatContext) => {
      const positionChanged = next.fen !== context.fen || next.variant !== context.variant
      const budgetChanged = next.depth !== context.depth || next.timeMs !== context.timeMs
      context = { ...next }
      if (positionChanged || !next.enabled) hide()
      else if (budgetChanged && state.active) void show()
    },
    activate: () => { live = true },
    dispose: () => { live = false; cancel(); state = { ...initialThreatState } },
  }
}
