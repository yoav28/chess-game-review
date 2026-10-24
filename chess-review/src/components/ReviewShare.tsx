import { useEffect, useRef, useState } from 'react'
import type { GameReview } from '../lib/review'
import { maxReviewTransferBytes, parseReviewTransfer, reviewTransferFilename, serializeReviewTransfer } from '../lib/review-transfer'
import './ReviewShare.css'

export function ReviewShare({ review, onImport }: { review: GameReview | null; onImport: (review: GameReview) => void | Promise<void> }) {
  const file = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    request.current++
    setBusy(false)
    setError('')
    setNotice('')
    return () => { request.current++ }
  }, [review])

  function download() {
    if (!review) return
    setError('')
    setNotice('')
    try {
      const content = serializeReviewTransfer(review)
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = reviewTransferFilename(review)
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Complete review downloaded. Send this file yourself; it is not uploaded by the app.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'This review could not be exported.') }
  }

  async function importFile(selected: File) {
    const current = ++request.current
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (selected.size > maxReviewTransferBytes) throw new Error('Review files must be 12 MB or smaller.')
      const source = await selected.text()
      if (request.current !== current) return
      const imported = parseReviewTransfer(source)
      if (request.current !== current) return
      await onImport(imported)
      if (request.current === current) setNotice('Review imported. Scores came from the file; no new engine analysis was run.')
    } catch (reason) {
      if (request.current === current) setError(reason instanceof Error ? reason.message : 'The review file could not be imported.')
    } finally { if (request.current === current) setBusy(false) }
  }

  return <section className="review-share" aria-label="Portable complete review">
    <h3>Share a complete review</h3>
    <p>Download the game, scores, explanations, and engine lines in one file. Import it here on another browser without rerunning the engine.</p>
    <div className="review-share-actions">
      <button className="secondary" disabled={!review || busy} onClick={download}>Download review file</button>
      <button className="text-button" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Checking review…' : 'Import review file'}</button>
    </div>
    <input ref={file} type="file" accept=".json,application/json" hidden aria-label="Choose complete review JSON" onChange={event => {
      const selected = event.target.files?.[0]
      event.target.value = ''
      if (selected) void importFile(selected)
    }} />
    <p className="fine-print">Files stay on your device until you share them. Imports validate the format and legal moves; engine scores and authorship are not authenticated. Maximum 12 MB / 2,000 plies.</p>
    {notice && <p className="review-share-notice" role="status">{notice}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}
