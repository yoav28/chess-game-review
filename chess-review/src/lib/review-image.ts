import type { Color, PieceSymbol } from 'chess.js'
import type { Evaluation } from '../engine/types'
import { classificationLabels, classificationSummary, type GameReview } from './review'
import { createPosition } from './position'
import { isVariantHeuristic, variantLabel } from './variants'
import { drawReviewBoard, loadReviewPieceImages } from './review-board-image'
import { normalizeBoardAppearance, type BoardAppearance } from './board-appearance'

export type ReviewImageOptions = Partial<BoardAppearance> & {
  ply?: number
  orientation?: Color
  pieceSvg?: (piece: PieceSymbol, color: Color) => string
}

const colors = { background: '#20221f', text: '#eeeede', muted: '#a5a99d', border: '#4b5144', accent: '#bdd09b', light: '#ede5d6', dark: '#809176' }
const score = (value: number | null) => value !== null && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Unavailable'
const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

export function reviewImageData(review: GameReview, options: ReviewImageOptions = {}) {
  const ply = typeof options.ply === 'number' && Number.isFinite(options.ply) ? Math.max(0, Math.min(review.moves.length, Math.round(options.ply))) : review.moves.length
  const move = review.moves[ply - 1]
  const fen = move?.afterFen ?? review.initialFen
  const board = createPosition(fen, review.variant)
  const checks = board.checksRemaining?.()
  const depths = review.moves.map(item => item.depth).filter(value => Number.isInteger(value) && value > 0)
  const minimum = depths.length ? Math.min(...depths) : null
  const maximum = depths.length ? Math.max(...depths) : null
  const model = review.variant && isVariantHeuristic(review.variant) ? `${variantLabel(review.variant)} quality heuristic v2 · uncalibrated for this variant` : review.accuracyVersion === 2 ? 'Win-chance move accuracy v2 · arithmetic mean' : 'Legacy centipawn move accuracy v1'
  const counts = classificationSummary.map(classification => ({
    label: classificationLabels[classification], white: review.moves.filter(item => item.color === 'w' && item.classification === classification).length,
    black: review.moves.filter(item => item.color === 'b' && item.classification === classification).length,
  }))
  const evaluations = [review.initialAnalysis.evaluation, ...review.moves.map(item => item.evaluation)]
  if (evaluations.some(value => !Number.isFinite(value.cp) || value.mate !== null && !Number.isFinite(value.mate))) throw new Error('This report has invalid evaluation data. Review the game again before exporting an image.')
  return {
    ply, move, board, fen, checks, orientation: options.orientation ?? 'w', counts, evaluations, model,
    white: clean(review.white), black: clean(review.black), whiteAccuracy: score(review.whiteAccuracy), blackAccuracy: score(review.blackAccuracy),
    result: ['1-0', '0-1', '1/2-1/2'].includes(review.result) ? review.result : 'Unfinished',
    positionLabel: move ? `Position after ${move.beforeFen.split(' ')[5]}${move.color === 'w' ? '.' : '…'} ${move.san}` : 'Starting position',
    selection: move ? `${move.san} · ${classificationLabels[move.classification]}${board.variantOutcome?.() ? ` · ${variantLabel(review.variant)} win` : ''}` : 'Before the first move',
    opening: review.opening ? `${review.opening.name} · ${review.opening.eco}` : review.variant !== 'chess' && review.variant ? `${variantLabel(review.variant)} · standard opening book does not apply` : 'No named opening recorded',
    engine: clean(review.engine), depth: minimum === null ? 'Recorded depth unavailable' : `Recorded depth ${minimum === maximum ? minimum : `${minimum}–${maximum}`}`,
    imported: Boolean(review.importedAt), provenance: review.importedAt ? 'Imported report · scores supplied in a file, not reanalyzed here' : 'Independent Open File review · engine estimates depend on search limits',
    analyzedAt: Number.isFinite(Date.parse(review.analyzedAt)) ? new Date(review.analyzedAt).toISOString().slice(0, 10) : 'Date unavailable',
  }
}

export function reviewImageFilename(review: GameReview): string {
  const safe = (value: string) => value.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'player'
  return `${safe(review.white)}-${safe(review.black)}-review.png`
}

export function reviewImageGraph(evaluations: Evaluation[], width: number, height: number) {
  return evaluations.map((evaluation, index) => ({
    x: index / Math.max(1, evaluations.length - 1) * width,
    y: height / 2 - Math.tanh(evaluation.cp / 450) * (height / 2 - 8),
  }))
}

function fitText(context: CanvasRenderingContext2D, content: string, x: number, y: number, width: number, size: number, color = colors.text) {
  context.fillStyle = color
  let current = size
  context.font = `${current}px system-ui, sans-serif`
  while (context.measureText(content).width > width && current > Math.max(13, size * 0.6)) { current--; context.font = `${current}px system-ui, sans-serif` }
  let text = content
  while (text && context.measureText(text).width > width) text = text.slice(0, -1)
  context.fillText(text === content ? text : `${text.slice(0, -1)}…`, x, y)
}

export async function createReviewImage(review: GameReview, options: ReviewImageOptions = {}): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('PNG export needs a browser with Canvas support.')
  const data = reviewImageData(review, options)
  const appearance = normalizeBoardAppearance(options)
  const images = await loadReviewPieceImages(options.pieceSvg, appearance.pieceSet)
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 1000
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot create a report image.')
  context.fillStyle = colors.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  fitText(context, 'Open File', 64, 57, 500, 26, colors.accent)
  fitText(context, `${variantLabel(review.variant)} · ${review.moves.length} half-moves · ${data.analyzedAt}`, 880, 57, 656, 19, colors.muted)
  fitText(context, `${data.white}  vs  ${data.black}`, 64, 123, 1472, 44)
  fitText(context, `Recorded result: ${data.result}`, 64, 163, 1200, 23, colors.muted)
  fitText(context, data.positionLabel, 64, 204, 640, 20)
  drawReviewBoard(context, { fen: data.fen, variant: review.variant, orientation: data.orientation, lastMove: data.move ? { from: data.move.from, to: data.move.kingTo ?? data.move.to } : undefined }, images, { x: 64, y: 220, size: 640, ...appearance })
  fitText(context, 'White accuracy', 760, 225, 340, 21, colors.muted)
  fitText(context, 'Black accuracy', 1150, 225, 340, 21, colors.muted)
  fitText(context, data.whiteAccuracy, 760, 286, 340, 47, colors.accent)
  fitText(context, data.blackAccuracy, 1150, 286, 340, 47, colors.accent)
  fitText(context, data.model, 760, 326, 776, 18, colors.muted)
  fitText(context, data.opening, 760, 373, 776, 23)
  fitText(context, data.engine, 760, 411, 776, 17, colors.muted)
  fitText(context, `${data.depth} · Time budget not recorded`, 760, 439, 776, 17, colors.muted)
  fitText(context, 'Evaluation timeline · White ↑ / Black ↓', 760, 479, 776, 18)
  const points = reviewImageGraph(data.evaluations, 776, 150)
  context.strokeStyle = colors.border
  context.lineWidth = 1
  context.beginPath(); context.moveTo(760, 580); context.lineTo(1536, 580); context.stroke()
  context.strokeStyle = colors.accent
  context.lineWidth = 3
  context.beginPath()
  points.forEach((point, index) => index === 0 ? context.moveTo(760 + point.x, 505 + point.y) : context.lineTo(760 + point.x, 505 + point.y))
  context.stroke()
  const selected = points[data.ply]
  context.strokeStyle = colors.text
  context.beginPath(); context.moveTo(760 + selected.x, 505); context.lineTo(760 + selected.x, 655); context.stroke()
  fitText(context, 'Start', 760, 680, 160, 15, colors.muted)
  fitText(context, `${Math.ceil(review.moves.length / 2)} moves`, 1400, 680, 136, 15, colors.muted)
  fitText(context, 'Move classifications', 760, 724, 776, 21)
  data.counts.forEach((count, index) => {
    const column = index < 6 ? 0 : 1
    const row = index < 6 ? index : index - 6
    const x = 760 + column * 398
    if (row === 0) { fitText(context, 'White', x + 225, 750, 70, 14, colors.muted); fitText(context, 'Black', x + 300, 750, 70, 14, colors.muted) }
    const y = 778 + row * 25
    fitText(context, count.label, x, y, 220, 16)
    fitText(context, String(count.white), x + 245, y, 45, 16, colors.accent)
    fitText(context, String(count.black), x + 320, y, 45, 16, colors.accent)
  })
  fitText(context, data.selection, 64, 899, 640, 22)
  fitText(context, `${data.ply} / ${review.moves.length} half-moves${data.checks ? ` · Checks W ${3 - data.checks.w}/3 · B ${3 - data.checks.b}/3` : ' shown on the board'}`, 64, 931, 640, 17, colors.muted)
  context.strokeStyle = colors.border
  context.beginPath(); context.moveTo(64, 951); context.lineTo(1536, 951); context.stroke()
  fitText(context, data.provenance, 64, 979, 1472, 18, data.imported ? '#e8cc89' : colors.muted)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed. Please try again.')), 'image/png'))
}
