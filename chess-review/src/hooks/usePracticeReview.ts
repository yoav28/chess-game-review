import { useEffect, useRef, useState } from 'react'
import { createPracticeReview, initialPracticeState } from '../lib/practice'
import type { GameReview } from '../lib/review'

export function usePracticeReview(review: GameReview | null, depth: number, timeMs: number) {
  const [state, setState] = useState(initialPracticeState)
  const controller = useRef<ReturnType<typeof createPracticeReview> | null>(null)
  if (!controller.current) controller.current = createPracticeReview(setState, { review, depth, timeMs })
  const service = controller.current
  useEffect(() => { service.activate(); return () => service.dispose() }, [service])
  useEffect(() => { service.configure(review, depth, timeMs) }, [service, review, depth, timeMs])
  return { ...state, begin: service.begin, setColor: service.setColor, attempt: service.attempt, showHint: service.showHint, showSolution: service.showSolution, next: service.next, stop: service.stop, reset: service.reset }
}
