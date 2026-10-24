import openingData from '../data/openings/lichess.json'

export type Opening = { name: string; eco: string }
type OpeningIndex = {
  openings: [name: string, eco: string][]
  nodes: [opening: number, edges: [uci: string, san: string, child: number][]][]
}

const index = openingData as unknown as OpeningIndex

export function openingForMoves(moves: string[]): { opening: Opening | null; book: boolean } {
  let nodeId = 0
  let opening: Opening | null = null
  if (!moves.length) return { opening, book: false }
  for (const move of moves) {
    const edge = index.nodes[nodeId][1].find(([uci, san]) => move === san || move === uci)
    if (!edge) return { opening, book: false }
    nodeId = edge[2]
    const label = index.nodes[nodeId][0]
    if (label !== -1) {
      const [name, eco] = index.openings[label]
      opening = { name, eco }
    }
  }
  return { opening, book: true }
}
