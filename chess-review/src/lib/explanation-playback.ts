import { buildExplanationSteps, type ExplanationStep } from './explanation'
import type { MoveReview } from './review'

export type ExplanationState = {
  active: boolean
  fen: string
  lastMove?: { from: string; to: string }
  currentStep: number
  steps: ExplanationStep[]
  playing: boolean
  error: string
}

export const initialExplanationState: ExplanationState = {
  active: false, fen: '', currentStep: 0, steps: [], playing: false, error: '',
}

export type ExplanationOptions = {
  autoplay?: boolean
  delayMs?: number
}

type Dependencies = ExplanationOptions & {
  reducedMotion?: () => boolean
  schedule?: (callback: () => void, delay: number) => () => void
}

export function createExplanationPlayback(onChange: (state: ExplanationState) => void, dependencies: Dependencies = {}) {
  const reducedMotion = dependencies.reducedMotion ?? (() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const schedule = dependencies.schedule ?? ((callback, delay) => {
    const timer = setTimeout(callback, delay)
    return () => clearTimeout(timer)
  })
  let state = { ...initialExplanationState }
  let live = true
  let cancelTimer: (() => void) | null = null
  let generation = 0
  let options = {
    autoplay: dependencies.autoplay ?? true,
    delayMs: normalizeDelay(dependencies.delayMs),
  }

  function normalizeDelay(value?: number) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(500, Math.min(5000, Math.round(value))) : 1300
  }

  function cancel() {
    generation++
    cancelTimer?.()
    cancelTimer = null
  }

  function emit() {
    const step = state.steps[state.currentStep]
    state = {
      ...state, fen: step?.fen ?? '',
      lastMove: step?.uci ? { from: step.uci.slice(0, 2), to: step.kingTo ?? step.uci.slice(2, 4) } : undefined,
    }
    if (live) onChange(state)
  }

  function queue() {
    cancel()
    if (!live || !state.active || !state.playing) return
    const owns = generation
    cancelTimer = schedule(() => {
      if (!live || owns !== generation || !state.active || !state.playing) return
      const currentStep = Math.min(state.currentStep + 1, state.steps.length - 1)
      state = { ...state, currentStep, playing: currentStep < state.steps.length - 1 }
      emit()
      queue()
    }, options.delayMs)
  }

  function seek(index: number) {
    if (!live || !state.active) return
    cancel()
    state = { ...state, currentStep: Math.max(0, Math.min(state.steps.length - 1, index)), playing: false }
    emit()
  }

  return {
    start: (move: MoveReview): boolean => {
      if (!live) return false
      cancel()
      try {
        const steps = buildExplanationSteps(move)
        state = { ...initialExplanationState, active: true, steps, playing: options.autoplay && !reducedMotion() && steps.length > 1 }
        emit()
        queue()
        return true
      } catch {
        state = { ...initialExplanationState, error: 'This move could not be explained because its saved position or move is invalid.' }
        emit()
        return false
      }
    },
    play: () => {
      if (!live || !state.active || state.steps.length < 2) return
      state = { ...state, playing: true, currentStep: state.currentStep === state.steps.length - 1 ? 0 : state.currentStep }
      emit()
      queue()
    },
    pause: () => {
      cancel()
      state = { ...state, playing: false }
      emit()
    },
    next: () => seek(state.currentStep + 1),
    previous: () => seek(state.currentStep - 1),
    reset: () => seek(0),
    stop: () => {
      cancel()
      state = { ...initialExplanationState }
      emit()
    },
    configure: (next: ExplanationOptions) => {
      const configured = {
        autoplay: typeof next.autoplay === 'boolean' ? next.autoplay : options.autoplay,
        delayMs: next.delayMs === undefined ? options.delayMs : normalizeDelay(next.delayMs),
      }
      if (configured.autoplay === options.autoplay && configured.delayMs === options.delayMs) return
      const pause = options.autoplay && !configured.autoplay
      options = configured
      if (pause) {
        state = { ...state, playing: false }
        emit()
      }
      queue()
    },
    activate: () => { live = true },
    dispose: () => {
      live = false
      cancel()
      state = { ...state, playing: false }
    },
  }
}
