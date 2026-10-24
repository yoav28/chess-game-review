import { useEffect, useRef, useState } from 'react'
import type { Color } from 'chess.js'
import type { GameReview } from '../lib/review'
import { reviewImageFilename } from '../lib/review-image'

export function ReviewAnimationExport({ review, orientation }: { review: GameReview; orientation: Color }) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [notice, setNotice] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => { request.current?.abort(); request.current = null; setProgress(null); setNotice(''); return () => { request.current?.abort(); request.current = null } }, [review, orientation])
  async function download() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setProgress({ done: 0, total: review.moves.length + 1 }); setNotice('')
    try {
      const { createReviewAnimation } = await import('../lib/review-animation')
      if (controller.signal.aborted) return
      const blob = await createReviewAnimation(review, { orientation, signal: controller.signal, onProgress: (done, total) => { if (request.current === controller) setProgress({ done, total }) } })
      if (request.current !== controller || controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = reviewImageFilename(review).replace(/\.png$/, '.gif'); link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Animated game downloaded. The GIF loops through every recorded move.')
    } catch (error) { if (request.current === controller && !controller.signal.aborted) setNotice(error instanceof Error ? error.message : 'Animation export failed.') }
    finally { if (request.current === controller) { request.current = null; setProgress(null) } }
  }
  return <section className="review-image-export" aria-label="Animated game export">
    <h3>Animated game</h3><p>Download every recorded position as a looping GIF. Large games can take longer to prepare.</p>
    {progress ? <><p role="status">Preparing frame {progress.done} / {progress.total}</p><progress value={progress.done} max={progress.total} /><button className="text-button" onClick={() => { request.current?.abort(); request.current = null; setProgress(null); setNotice('Animation export stopped.') }}>Stop export</button></> : <button className="secondary" onClick={() => void download()}>Download game GIF</button>}
    {notice && <p className="fine-print" role="status">{notice}</p>}
  </section>
}
