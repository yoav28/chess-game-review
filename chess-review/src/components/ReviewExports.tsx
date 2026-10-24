import { useId, useState } from 'react'
import type { Color } from 'chess.js'
import type { GameReview } from '../lib/review'
import { ReviewShare } from './ReviewShare'
import { ReviewImageExport } from './ReviewImageExport'
import { ReviewAnimationExport } from './ReviewAnimationExport'
import { ReviewEmbedExport } from './ReviewEmbedExport'

export function ReviewExports({ review, ply, orientation, onImport }: { review: GameReview; ply: number; orientation: Color; onImport: (review: GameReview) => void }) {
  const [format, setFormat] = useState('report')
  const id = useId()
  return <section className="review-export-options" aria-label="Share and export review">
    <label htmlFor={id}>Export format</label><select id={id} value={format} onChange={event => setFormat(event.target.value)}><option value="report">Complete review file</option><option value="image">Report image · PNG</option><option value="animation">Animated game · GIF</option><option value="embed">Replay HTML / embed</option></select>
    {format === 'report' ? <ReviewShare review={review} onImport={onImport} /> : format === 'image' ? <ReviewImageExport review={review} ply={ply} orientation={orientation} /> : format === 'animation' ? <ReviewAnimationExport review={review} orientation={orientation} /> : <ReviewEmbedExport review={review} ply={ply} orientation={orientation} />}
  </section>
}
