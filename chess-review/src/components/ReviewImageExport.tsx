import { useEffect, useRef, useState } from 'react'
import type { Color } from 'chess.js'
import type { GameReview } from '../lib/review'
import { createReviewImage, reviewImageFilename } from '../lib/review-image'
import './ReviewImageExport.css'

export function ReviewImageExport({ review, ply, orientation = 'w' }: { review: GameReview; ply?: number; orientation?: Color }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(true)
  const generation = useRef(0)
  useEffect(() => { generation.current++; setBusy(false); setNotice(''); setError(''); return () => { generation.current++ } }, [review, ply, orientation, selected])
  async function download() {
    const current = ++generation.current
    setBusy(true)
    setNotice('')
    setError('')
    try {
      const blob = await createReviewImage(review, { ply: selected ? ply : undefined, orientation })
      if (generation.current !== current) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = reviewImageFilename(review)
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Report image downloaded. Nothing was uploaded.')
    } catch (reason) {
      if (generation.current === current) setError(reason instanceof Error ? reason.message : 'The report image could not be created.')
    } finally { if (generation.current === current) setBusy(false) }
  }
  return <section className="review-image-export" aria-label="Report image export">
    <h3>Report image</h3>
    <p>Download a 1600 × 1000 PNG with the board, scores, evaluation timeline, and move counts.</p>
    {ply !== undefined && <label><input type="checkbox" checked={selected} onChange={event => setSelected(event.target.checked)} />Use selected position instead of the final position</label>}
    <button className="secondary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing image…' : 'Download report image'}</button>
    <p className="fine-print">Created in this browser using the app’s original piece artwork. Imported reports retain a visible file-provided notice.</p>
    {notice && <p className="review-image-notice" role="status">{notice}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}
