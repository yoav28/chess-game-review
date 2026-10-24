import type { Color, PieceSymbol, Square } from 'chess.js'
import { createPosition, type ChessVariant } from './position'
import { pieceArtwork } from './piece-artwork'
import { boardThemes, normalizeBoardAppearance, type BoardTheme, type PieceSet } from './board-appearance'

const prepared = new Map<PieceSet, Promise<Map<string, HTMLImageElement>>>()

export function loadReviewPieceImages(makeSvg?: (type: PieceSymbol, color: Color) => string, set: PieceSet = 'classic'): Promise<Map<string, HTMLImageElement>> {
  const key = normalizeBoardAppearance({ pieceSet: set }).pieceSet
  if (!makeSvg && prepared.has(key)) return prepared.get(key)!
  const pending = (async () => {
    const artwork = makeSvg ? null : await pieceArtwork(key)
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
  if (!makeSvg) prepared.set(key, pending.catch(error => { prepared.delete(key); throw error }))
  return makeSvg ? pending : prepared.get(key)!
}

export function drawReviewBoard(context: CanvasRenderingContext2D, position: { fen: string; variant?: ChessVariant; orientation?: Color; lastMove?: { from: string; to: string } }, images: Map<string, HTMLImageElement>, options: { x?: number; y?: number; size?: number; coordinates?: boolean; boardTheme?: BoardTheme } = {}) {
  const board = createPosition(position.fen, position.variant)
  const theme = boardThemes[normalizeBoardAppearance(options).boardTheme]
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
    context.fillStyle = dark ? theme.dark : theme.light
    context.fillRect(x, y, step, step)
    if ([position.lastMove?.from, position.lastMove?.to].includes(square)) {
      context.fillStyle = dark ? theme.lastDark : theme.lastLight; context.fillRect(x, y, step, step)
    }
    const piece = board.get(square)
    if (piece) {
      const image = images.get(`${piece.color}${piece.type}`)
      if (!image) throw new Error('A board piece is missing from the export artwork.')
      context.drawImage(image, x + step * 0.04, y + step * 0.04, step * 0.92, step * 0.92)
    }
    if (options.coordinates !== false) {
      context.fillStyle = dark ? theme.darkText : theme.lightText
      context.font = `${Math.max(10, step * 0.175)}px system-ui, sans-serif`
      if (index % 8 === 0) context.fillText(String(rank), x + 4, y + step * 0.22)
      if (Math.floor(index / 8) === 7) context.fillText(files[file], x + step * 0.81, y + step * 0.94)
    }
  }
  context.restore()
}
