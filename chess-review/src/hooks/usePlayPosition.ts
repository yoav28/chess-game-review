import { useEffect, useRef, useState } from 'react'
import { createPlayPosition, initialPlayPositionState } from '../lib/play-position'

export function usePlayPosition(depth: number, timeMs: number) {
  const [state, setState] = useState(initialPlayPositionState)
  const player = useRef<ReturnType<typeof createPlayPosition> | null>(null)
  if (!player.current) player.current = createPlayPosition(setState, { depth, timeMs })
  const service = player.current

  useEffect(() => { service.activate(); return () => service.dispose() }, [service])
  useEffect(() => { service.configure(depth, timeMs) }, [service, depth, timeMs])

  return {
    ...state, start: service.start, move: service.move, undo: service.undo,
    restart: service.restart, stop: service.stop, setPlayerColor: service.setPlayerColor, retry: service.retry,
  }
}

export type PlayPosition = ReturnType<typeof usePlayPosition>
