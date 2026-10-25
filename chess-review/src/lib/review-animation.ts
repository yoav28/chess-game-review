import type { Color } from 'chess.js'
import type { GameReview } from './review'
import { parsePgn } from './game'
import { drawReviewBoard, loadReviewPieceImages } from './review-board-image'
import { createPosition } from './position'
import { variantLabel } from './variants'
import { normalizeBoardAppearance, type BoardAppearance } from './board-appearance'

export function reviewAnimationFrames(review: GameReview, options: { from?: number; to?: number; delayMs?: number } = {}) {
  const parsed = parsePgn(review.pgn, review.variant)
  if (parsed.moves.length !== review.moves.length || parsed.initialFen !== review.initialFen || review.moves.some((move, index) => move.uci !== parsed.moves[index].uci || move.afterFen !== parsed.positions[index + 1])) throw new Error('The report and its game moves do not match.')
  const bounded = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(review.moves.length, Math.round(value!))) : fallback
  const from = bounded(options.from, 0)
  const to = Math.max(from, bounded(options.to, review.moves.length))
  const delay = Number.isFinite(options.delayMs) ? Math.max(200, Math.min(3000, Math.round(options.delayMs! / 10) * 10)) : 800
  return parsed.positions.slice(from, to + 1).map((fen, index) => {
    const ply = from + index
    const move = review.moves[ply - 1]
    return { fen, ply, lastMove: move ? { from: move.from, to: move.kingTo ?? move.to } : undefined,
      label: move ? `${move.beforeFen.split(' ')[5]}${move.color === 'w' ? '.' : '…'} ${move.san}` : 'Starting position',
      delay: index === to - from ? Math.max(2500, delay) : index === 0 ? Math.max(1400, delay) : delay }
  })
}

export async function createReviewAnimation(review: GameReview, options: Partial<BoardAppearance> & { from?: number; to?: number; delayMs?: number; orientation?: Color; signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<Blob> {
  const frames = reviewAnimationFrames(review, options)
  const { signal } = options
  const abort = () => { if (signal?.aborted) throw new DOMException('Animation export cancelled.', 'AbortError') }
  abort()
  const appearance = normalizeBoardAppearance(options)
  const [{ GIFEncoder, quantize, applyPalette }, pieces] = await Promise.all([import('gifenc'), loadReviewPieceImages(undefined, appearance.pieceSet)])
  abort()
  const canvas = document.createElement('canvas')
  canvas.width = 720; canvas.height = 790
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('This browser cannot draw an animated board.')
  const gif = GIFEncoder()
  for (const [index, frame] of frames.entries()) {
    abort()
    context.fillStyle = '#20221f'; context.fillRect(0, 0, 720, 790)
    context.fillStyle = '#eeeede'; context.font = '18px system-ui, sans-serif'
    const title = `${review.white} vs ${review.black}${review.variant && review.variant !== 'chess' ? ` · ${variantLabel(review.variant)}` : ''}`
    context.fillText(title.length > 65 ? `${title.slice(0, 62)}…` : title, 40, 32, 640)
    drawReviewBoard(context, { fen: frame.fen, variant: review.variant, orientation: options.orientation, lastMove: frame.lastMove }, pieces, { x: 40, y: 50, size: 640, ...appearance })
    context.fillStyle = '#bdd09b'; context.font = '20px system-ui, sans-serif'
    context.fillText(`${frame.label} · ${frame.ply}/${review.moves.length}`, 40, 726, 640)
    context.fillStyle = '#a5a99d'; context.font = '14px system-ui, sans-serif'
    const checks = createPosition(frame.fen, review.variant).checksRemaining?.()
    context.fillText(checks ? `Checks W ${3 - checks.w}/3 · B ${3 - checks.b}/3${review.importedAt ? ' · imported report' : ''}` : review.importedAt ? 'Open File · imported report · recorded game replay' : 'Open File · recorded game replay', 40, 760, 640)
    const rgba = context.getImageData(0, 0, 720, 790).data
    const palette = quantize(rgba, 256)
    gif.writeFrame(applyPalette(rgba, palette), 720, 790, { palette, delay: frame.delay, repeat: 0, dispose: 2 })
    options.onProgress?.(index + 1, frames.length)
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  abort()
  gif.finish()
  return new Blob([new Uint8Array(gif.bytes()).buffer], { type: 'image/gif' })
}
