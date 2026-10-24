import { useEffect, useReducer, useRef, useState } from 'react'
import { StockfishEngine } from '../engine/stockfish'
import { browserThreadLimit, engineThreads } from '../engine/search-options'
import type { AnalysisOptions, PositionAnalysis } from '../engine/types'
import type { ChessVariant } from '../lib/position'
import type { Settings } from '../lib/settings'

type PositionAnalysisOptions = {
  tab: string
  engineEnabled: boolean
  running: boolean
  fen: string
  settings: Pick<Settings, 'analysisTimeMs' | 'analysisThreads' | 'analysisLines'>
  parseError: string
  analysisHistory: NonNullable<AnalysisOptions['history']>
  variant: ChessVariant
}
type Job = { controller: AbortController; engine: StockfishEngine | null; timer: ReturnType<typeof setTimeout> | null }
type Result = { analysis: PositionAnalysis; history: PositionAnalysisOptions['analysisHistory']; timeMs: number; threads: number; lines: number; revision: number }

export function usePositionAnalysis({ tab, engineEnabled, running, fen, settings, parseError, analysisHistory, variant }: PositionAnalysisOptions) {
  const [result, setResult] = useState<Result | null>(null)
  const [engineBusy, setEngineBusy] = useState(false)
  const [engineError, setEngineError] = useState('')
  const [engineStopped, setEngineStopped] = useState(false)
  const [revision, restartAnalysis] = useReducer(value => value + 1, 0)
  const active = useRef<Job | null>(null)
  const threads = Math.min(engineThreads(settings.analysisThreads), browserThreadLimit())

  function stopAnalysis() {
    const job = active.current
    if (!job) return
    setEngineStopped(true)
    if (job.engine) job.engine.stop()
    else {
      if (job.timer) clearTimeout(job.timer)
      job.controller.abort()
      active.current = null
      setEngineBusy(false)
    }
  }

  useEffect(() => {
    if (tab !== 'analysis' || !engineEnabled || running || parseError) { setEngineBusy(false); return }
    const job: Job = { controller: new AbortController(), engine: null, timer: null }
    active.current = job
    const owns = () => active.current === job && !job.controller.signal.aborted
    const publish = (analysis: PositionAnalysis) => {
      if (owns()) setResult({ analysis, history: analysisHistory, timeMs: settings.analysisTimeMs, threads, lines: settings.analysisLines, revision })
    }
    setEngineBusy(true); setEngineError(''); setEngineStopped(false); setResult(null)
    job.timer = setTimeout(async () => {
      job.timer = null
      try {
        job.engine = new StockfishEngine(job.controller.signal, variant, threads)
        const analysis = await job.engine.analyze(fen, {
          limit: settings.analysisTimeMs === 0 ? 'continuous' : 'time', timeMs: settings.analysisTimeMs,
          multiPv: settings.analysisLines, history: analysisHistory, variant, onUpdate: publish,
        })
        publish(analysis)
      } catch (error) {
        if (owns() && !(error instanceof Error && error.name === 'AbortError')) setEngineError(error instanceof Error ? error.message : 'Engine analysis failed.')
      } finally {
        job.engine?.dispose()
        if (owns()) { active.current = null; setEngineBusy(false) }
      }
    }, 160)
    return () => {
      if (active.current === job) active.current = null
      if (job.timer) clearTimeout(job.timer)
      job.controller.abort()
    }
  }, [tab, engineEnabled, running, fen, settings.analysisTimeMs, settings.analysisLines, threads, parseError, analysisHistory, variant, revision])

  const matches = result?.analysis.fen === fen && result.analysis.variant === variant && result.history === analysisHistory && result.threads === threads && result.timeMs === settings.analysisTimeMs && result.lines === settings.analysisLines && result.revision === revision
  return { positionAnalysis: matches ? result.analysis : null, engineBusy, engineError, engineStopped, analysisThreads: threads, stopAnalysis, restartAnalysis }
}
