import { useEffect, useRef, useState } from 'react'
import type { Color } from 'chess.js'
import type { GameReview } from '../lib/review'
import { downloadText } from '../lib/storage'
import { reviewImageFilename } from '../lib/review-image'

export function ReviewEmbedExport({ review, ply, orientation }: { review: GameReview; ply: number; orientation: Color }) {
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const request = useRef(0)
  useEffect(() => { request.current++; setBusy(false); setNotice(''); setCode(''); return () => { request.current++ } }, [review, ply, orientation])
  async function create(action: 'download' | 'copy') {
    const current = ++request.current
    setBusy(true); setNotice('')
    try {
      const { createReviewEmbed } = await import('../lib/review-embed')
      const embed = await createReviewEmbed(review, { ply, orientation })
      if (request.current !== current) return
      setCode(embed.iframe)
      if (action === 'copy') { await navigator.clipboard.writeText(embed.iframe); if (request.current === current) setNotice('Sandboxed iframe code copied. Paste it into a site that permits srcdoc embeds.') }
      else { downloadText(embed.document, reviewImageFilename(review).replace(/\.png$/, '.html')); setNotice('Offline replay downloaded. Open the HTML file in a browser.') }
    } catch (error) { if (request.current === current) setNotice(error instanceof Error ? error.message : 'Embed export failed.') }
    finally { if (request.current === current) setBusy(false) }
  }
  return <section className="review-image-export" aria-label="Embeddable review export"><h3>Embed a replay</h3><p>Create an offline HTML replay or copy a sandboxed iframe. It includes the game, scores, and recorded explanations; no account or server is required.</p><div className="review-share-actions"><button className="secondary" disabled={busy} onClick={() => void create('download')}>Download replay HTML</button><button className="text-button" disabled={busy} onClick={() => void create('copy')}>Copy embed code</button></div><p className="fine-print">Anyone receiving the file or embed code can read its contents. The replay supports navigation, autoplay, orientation, and coordinates. It does not run an engine.</p>{notice && <p role="status" className="fine-print">{notice}</p>}{code && <details><summary>View embed code</summary><textarea aria-label="Embed code" readOnly value={code} rows={5} /></details>}</section>
}
