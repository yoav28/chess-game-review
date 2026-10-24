import { useEffect, useRef, useState } from 'react'
import type { GameRecord } from '../lib/game'
import { reviewGame, type GameReview } from '../lib/review'
import type { ReviewProgress } from '../engine/types'
import { loadReview, saveReview } from '../lib/storage'

export function useReview(game: GameRecord, depth: number, timeMs: number) {
  const [review, setReview] = useState<GameReview | null>(null)
  const [progress, setProgress] = useState<ReviewProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [cacheNotice, setCacheNotice] = useState('')
  const controller = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const current = useRef({ id: game.id, pgn: game.pgn })
  current.current = { id: game.id, pgn: game.pgn }

  useEffect(() => {
    controller.current?.abort()
    setRunning(false)
    setReview(null)
    setProgress(null)
    setError('')
    setCacheNotice('')
    const version = ++generation.current
    let active = true
    loadReview(game.id).then(saved => {
      if (active && generation.current === version && current.current.id === game.id && current.current.pgn === game.pgn && saved?.pgn === game.pgn && saved.version === 1) setReview(saved)
    }).catch(() => {})
    return () => { active = false; generation.current++; controller.current?.abort() }
  }, [game.id, game.pgn])

  async function start() {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    const version = ++generation.current
    const id = game.id
    const pgn = game.pgn
    const isCurrent = () => !request.signal.aborted && controller.current === request && generation.current === version && current.current.id === id && current.current.pgn === pgn
    setError('')
    setCacheNotice('')
    setRunning(true)
    setProgress({ completed: 0, total: 0, percent: 0 })
    try {
      const report = await reviewGame(pgn, { depth, timeMs, signal: request.signal, onProgress: value => { if (isCurrent()) setProgress(value) } })
      if (!isCurrent()) return
      setReview(report)
      await saveReview(id, report).catch(() => { if (isCurrent()) setCacheNotice('Review is ready. Browser storage is unavailable, so it will not be saved after you close this tab.') })
    } catch (e) {
      if (isCurrent()) setError((e as Error).message)
    } finally { if (controller.current === request) setRunning(false) }
  }

  return { review, progress, running, error, cacheNotice, start, cancel: () => controller.current?.abort() }
}
