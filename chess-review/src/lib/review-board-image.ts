import type { Color, PieceSymbol, Square } from 'chess.js'
import { createPosition, type ChessVariant } from './position'
import { pieceArtwork } from './piece-artwork'

let prepared: Promise<Map<string, HTMLImageElement>> | undefined

export function loadReviewPieceImages(makeSvg?: (type: PieceSymbol, color: Color) => string): Promise<Map<string, HTMLImageElement>> {
  if (!makeSvg && prepared) return prepared
  const pending = (async () => {
    const artwork = makeSvg ? null : await pieceArtwork()
    const images = new Map<string, HTMLImageElement>()
    await Promise.all((['w', 'b'] as Color[]).flatMap(color => (['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]).map(async type => {
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Board artwork preparation timed out.')), 10000)
        image.onload = () => { clearTimeout(timer); resolve() }
        image.onerror = () => { clearTimeout(timer); reject(new Error('The original board artwork could not be loaded.')) }
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makeSvg ? makeSvg(type, color) : artwork![`${color}${type}`])}`
      })
      images.set(`${color}${type}`, image)
    })))
    return images
  })()
  if (!makeSvg) prepared = pending.catch(error => { prepared = undefined; throw error })
  return makeSvg ? pending : prepared!
}

export function drawReviewBoard(context: CanvasRenderingContext2D, position: { fen: string; variant?: ChessVariant; orientation?: Color; lastMove?: { from: string; to: string } }, images: Map<string, HTMLImageElement>, options: { x?: number; y?: number; size?: number; coordinates?: boolean } = {}) {
  const board = createPosition(position.fen, position.variant)
  const size = options.size ?? 640
  const step = size / 8
  const files = 'abcdefgh'
  context.save()
  for (let index = 0; index < 64; index++) {
    const file = position.orientation === 'b' ? 7 - index % 8 : index % 8
    const rank = position.orientation === 'b' ? 1 + Math.floor(index / 8) : 8 - Math.floor(index / 8)
    const square = `${files[file]}${rank}` as Square
    const x = (options.x ?? 0) + index % 8 * step
    const y = (options.y ?? 0) + Math.floor(index / 8) * step
    const dark = (file + rank) % 2 === 0
    context.fillStyle = dark ? '#809176' : '#ede5d6'
    context.fillRect(x, y, step, step)
    if ([position.lastMove?.from, position.lastMove?.to].includes(square)) {
      context.globalAlpha = 0.65; context.fillStyle = '#c6c36f'; context.fillRect(x, y, step, step); context.globalAlpha = 1
    }
    const piece = board.get(square)
    if (piece) {
      const image = images.get(`${piece.color}${piece.type}`)
      if (!image) throw new Error('A board piece is missing from the export artwork.')
      context.drawImage(image, x + step * 0.04, y + step * 0.04, step * 0.92, step * 0.92)
    }
    if (options.coordinates !== false) {
      context.fillStyle = dark ? '#ede5d6' : '#45523b'
      context.font = `${Math.max(10, step * 0.175)}px system-ui, sans-serif`
      if (index % 8 === 0) context.fillText(String(rank), x + 4, y + step * 0.22)
      if (Math.floor(index / 8) === 7) context.fillText(files[file], x + step * 0.81, y + step * 0.94)
    }
  }
  context.restore()
}
