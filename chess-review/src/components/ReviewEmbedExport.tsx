import { useEffect, useRef, useState } from 'react'
import type { Color } from 'chess.js'
import type { GameReview } from '../lib/review'
import { downloadText } from '../lib/storage'
import { reviewImageFilename } from '../lib/review-image'

export function ReviewEmbedExport({ review, ply, orientation }: { review: GameReview; ply: number; orientation: Color }) {
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [puzzle, setPuzzle] = useState(false)
  const [start, setStart] = useState('beginning')
  const request = useRef(0)
  const invalid = puzzle && start === 'selected' && ply >= review.moves.length
  useEffect(() => { request.current++; setBusy(false); setNotice(''); setCode(''); return () => { request.current++ } }, [review, ply, orientation, puzzle, start])
  async function create(action: 'download' | 'copy') {
    const current = ++request.current
    setBusy(true); setNotice('')
    try {
      const { createReviewEmbed } = await import('../lib/review-embed')
      const embed = await createReviewEmbed(review, { ply: puzzle && start === 'beginning' ? 0 : ply, orientation, puzzle })
      if (request.current !== current) return
      setCode(embed.iframe)
      if (action === 'copy') { await navigator.clipboard.writeText(embed.iframe); if (request.current === current) setNotice('Sandboxed iframe code copied. Paste it into a site that permits srcdoc embeds.') }
      else { downloadText(embed.document, reviewImageFilename(review).replace(/-review\.png$/, puzzle ? '-puzzle.html' : '-review.html')); setNotice(`Offline ${puzzle ? 'puzzle' : 'replay'} downloaded. Open the HTML file in a browser.`) }
    } catch (error) { if (request.current === current) setNotice(error instanceof Error ? error.message : 'Embed export failed.') }
    finally { if (request.current === current) setBusy(false) }
  }
  return <section className="review-image-export" aria-label="Embeddable review export">
    <h3>Embed a replay or puzzle</h3>
    <p>Create an offline HTML file or copy a sandboxed iframe. It includes the game, scores, and recorded explanations; no account or server is required.</p>
    <label><input type="checkbox" checked={puzzle} disabled={!review.moves.length} onChange={event => setPuzzle(event.target.checked)} />Puzzle mode · guess the recorded moves</label>
    {puzzle && <><label>Start at<select aria-label="Puzzle starting position" value={start} onChange={event => setStart(event.target.value)}><option value="beginning">Game beginning</option><option value="selected">Selected position · {ply}/{review.moves.length}</option></select></label><p className="fine-print">The side to move guesses its recorded moves; opponent replies play automatically. Hint, retry, solution, and reset work offline. Other good moves may differ from the game.</p></>}
    {invalid && <p role="status">Select a position before the final move, or start at the game beginning.</p>}
    <div className="review-share-actions"><button className="secondary" disabled={busy || invalid} onClick={() => void create('download')}>Download {puzzle ? 'puzzle' : 'replay'} HTML</button><button className="text-button" disabled={busy || invalid} onClick={() => void create('copy')}>Copy embed code</button></div>
    <p className="fine-print">Anyone receiving the file or embed code can read its contents, including the solution. The replay supports navigation, autoplay, orientation, and coordinates. It does not run an engine.</p>
    {notice && <p role="status" className="fine-print">{notice}</p>}{code && <details><summary>View embed code</summary><textarea aria-label="Embed code" readOnly value={code} rows={5} /></details>}
  </section>
}
