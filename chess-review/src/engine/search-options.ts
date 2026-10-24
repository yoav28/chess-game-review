import type { AnalysisOptions } from './types'

const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback
export const engineThreads = (value: unknown) => bounded(value, 1, 1, 8)
export const analysisTimeLimits = [3000, 5000, 10000, 20000, 30000, 0] as const
export const analysisTimeLimit = (value: unknown): number => analysisTimeLimits.includes(value as typeof analysisTimeLimits[number]) ? value as number : 5000

export function browserThreadLimit() {
  if (globalThis.crossOriginIsolated !== true || typeof SharedArrayBuffer === 'undefined') return 1
  return typeof navigator === 'undefined' ? 1 : engineThreads(navigator.hardwareConcurrency)
}

export function searchCommand(options: AnalysisOptions) {
  if (options.limit === 'continuous') return { command: 'go infinite', timeout: null }
  const time = bounded(options.timeMs, 500, 30, 30000)
  const depth = bounded(options.depth, 16, 4, 24)
  return { command: options.limit === 'time' ? `go movetime ${time}` : `go depth ${depth} movetime ${time}`, timeout: Math.max(30000, time * 4) }
}
