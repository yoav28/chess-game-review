import { createElement } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { Piece } from '../components/ChessPiece'
import { normalizeBoardAppearance, type PieceSet } from './board-appearance'

const cached = new Map<PieceSet, Promise<Record<string, string>>>()

export async function pieceArtwork(set: PieceSet = 'classic'): Promise<Record<string, string>> {
  const key = normalizeBoardAppearance({ pieceSet: set }).pieceSet
  if (!cached.has(key)) cached.set(key, import('react-dom/server').then(({ renderToStaticMarkup }) => {
    const entries: [string, string][] = []
    for (const color of ['w', 'b'] as Color[]) for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) {
      const fill = color === 'w' ? '#fffaf0' : '#30342e'
      const stroke = color === 'w' ? '#48483d' : '#eee9db'
      const svg = renderToStaticMarkup(createElement(Piece, { type, color, set: key }))
        .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="${fill}" stroke="${stroke}" `)
        .replaceAll('class="chess-piece-detail"', `class="chess-piece-detail" fill="${stroke}"`)
      entries.push([`${color}${type}`, svg])
    }
    return Object.freeze(Object.fromEntries(entries))
  }).catch(error => { cached.delete(key); throw error }))
  return cached.get(key)!
}
