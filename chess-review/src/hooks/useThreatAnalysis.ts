import { useEffect, useMemo, useRef, useState } from 'react'
import { threatPosition } from '../lib/threat-analysis'
import { createThreatSession, initialThreatState, type ThreatContext } from '../lib/threat-session'

export function useThreatAnalysis(options: ThreatContext) {
  const [state, setState] = useState(initialThreatState)
  const session = useRef<ReturnType<typeof createThreatSession> | null>(null)
  if (!session.current) session.current = createThreatSession(setState, options)
  const service = session.current
  const eligibility = useMemo(() => threatPosition(options.fen, options.variant), [options.fen, options.variant])

  useEffect(() => { service.activate(); return () => service.dispose() }, [service])
  useEffect(() => { service.configure(options) }, [service, options.fen, options.variant, options.enabled, options.depth, options.timeMs])
  const matches = options.enabled && eligibility.eligible && state.result?.sourceFen === eligibility.sourceFen && state.result.variant === eligibility.variant

  return { ...state, active: options.enabled && state.active, result: matches ? state.result : null, eligibility, show: service.show, hide: service.hide, stop: service.hide }
}

export type ThreatAnalysis = ReturnType<typeof useThreatAnalysis>
