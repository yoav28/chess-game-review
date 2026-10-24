import { useEffect, useRef, useState } from 'react'
import { createExplanationPlayback, initialExplanationState, type ExplanationOptions } from '../lib/explanation-playback'

export function useExplanation(options: ExplanationOptions = {}) {
  const [state, setState] = useState(initialExplanationState)
  const playback = useRef<ReturnType<typeof createExplanationPlayback> | null>(null)
  if (!playback.current) playback.current = createExplanationPlayback(setState, options)
  const service = playback.current

  useEffect(() => {
    service.activate()
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onChange = () => { if (preference?.matches) service.pause() }
    preference?.addEventListener('change', onChange)
    return () => {
      preference?.removeEventListener('change', onChange)
      service.dispose()
    }
  }, [service])
  useEffect(() => { service.configure({ autoplay: options.autoplay ?? true, delayMs: options.delayMs ?? 1300 }) }, [service, options.autoplay, options.delayMs])

  return {
    ...state, start: service.start, play: service.play, pause: service.pause,
    next: service.next, previous: service.previous, reset: service.reset, stop: service.stop,
  }
}

export type Explanation = ReturnType<typeof useExplanation>
