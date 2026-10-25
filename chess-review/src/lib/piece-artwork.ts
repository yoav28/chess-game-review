import { createElement } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { Piece } from '../components/ChessPiece'
import { normalizeBoardAppearance, type PieceSet } from './board-appearance'

const cached = new Map<PieceSet, Promise<Record<string, string>>>()

type PngLoader = (path: string) => Promise<Uint8Array>

async function loadPublicPng(path: string): Promise<Uint8Array> {
  const response = await fetch(path)
  if (!response.ok) throw new Error('A Classic piece image could not be loaded for export.')
  return new Uint8Array(await response.arrayBuffer())
}

function dataUrl(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:image/png;base64,${btoa(binary)}`
}

export async function pieceArtwork(set: PieceSet = 'classic', loadPng: PngLoader = loadPublicPng): Promise<Record<string, string>> {
  const key = normalizeBoardAppearance({ pieceSet: set }).pieceSet
  if (!cached.has(key)) cached.set(key, import('react-dom/server').then(async ({ renderToStaticMarkup }) => {
    const entries: [string, string][] = []
    for (const color of ['w', 'b'] as Color[]) for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) {
      const fill = color === 'w' ? '#fffaf0' : '#30342e'
      const stroke = color === 'w' ? '#48483d' : '#eee9db'
      const svg = key === 'classic'
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" data-piece-set="classic"><image href="${dataUrl(await loadPng(`/pieces/classic/${color}${type}.png`))}" width="80" height="80" /></svg>`
        : renderToStaticMarkup(createElement(Piece, { type, color, set: key }))
          .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="${fill}" stroke="${stroke}" `)
          .replaceAll('class="chess-piece-detail"', `class="chess-piece-detail" fill="${stroke}"`)
      entries.push([`${color}${type}`, svg])
    }
    return Object.freeze(Object.fromEntries(entries))
  }).catch(error => { cached.delete(key); throw error }))
  return cached.get(key)!
}
