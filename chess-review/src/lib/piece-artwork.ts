import { createElement } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { Piece } from '../components/ChessPiece'

let cached: Promise<Record<string, string>> | undefined

export async function pieceArtwork(): Promise<Record<string, string>> {
  if (!cached) cached = import('react-dom/server').then(({ renderToStaticMarkup }) => {
    const entries: [string, string][] = []
    for (const color of ['w', 'b'] as Color[]) for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) {
      const fill = color === 'w' ? '#fffaf0' : '#30342e'
      const stroke = color === 'w' ? '#48483d' : '#eee9db'
      const svg = renderToStaticMarkup(createElement(Piece, { type, color }))
        .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="${fill}" stroke="${stroke}" `)
        .replace('class="chess-piece-detail"', `class="chess-piece-detail" fill="${stroke}"`)
      entries.push([`${color}${type}`, svg])
    }
    return Object.freeze(Object.fromEntries(entries))
  }).catch(error => { cached = undefined; throw error })
  return cached
}
