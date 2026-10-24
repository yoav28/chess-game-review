import type { Color } from 'chess.js'
import type { GameReview } from './review'
import { reviewAnimationFrames } from './review-animation'
import { pieceArtwork } from './piece-artwork'
import { embedPlayerScript } from './embed-player'

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export function buildReviewEmbed(review: GameReview, artwork: Record<string, string>, options: { ply?: number; orientation?: Color; coordinates?: boolean } = {}) {
  const frames = reviewAnimationFrames(review)
  const selected = Number.isFinite(options.ply) ? Math.max(0, Math.min(review.moves.length, Math.round(options.ply!))) : review.moves.length
  const payload = {
    white: review.white, black: review.black, result: review.result, imported: Boolean(review.importedAt),
    model: review.accuracyVersion === 2 ? 'Win-chance accuracy v2' : 'Legacy accuracy v1', whiteAccuracy: review.whiteAccuracy, blackAccuracy: review.blackAccuracy,
    frames: frames.map(frame => ({ ...frame, explanation: frame.ply ? review.moves[frame.ply - 1].explanation : 'Before the first recorded move.' })),
    artwork: Object.fromEntries(Object.entries(artwork).filter(([key]) => /^[wb][pnbrqk]$/.test(key)).map(([key, svg]) => [key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`])),
    selected, orientation: options.orientation ?? 'w', coordinates: options.coordinates !== false,
  }
  const title = `${review.white} vs ${review.black} · Open File`
  const document = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>${escape(title)}</title>
<style>body{margin:0;background:#20221f;color:#eeeede;font:15px system-ui,sans-serif}main{max-width:680px;margin:auto;padding:18px}h1{font-size:20px;margin:0 0 8px}p{line-height:1.6}button,input{font:inherit}button{background:#3a3e35;color:inherit;border:1px solid #68745b;border-radius:4px;padding:8px 12px;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #bdd09b}button:disabled{opacity:.4}#board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;max-width:640px}#board>div{position:relative;display:grid;place-items:center;min-width:0;background:#ede5d6}#board .dark{background:#809176}#board .last{box-shadow:inset 0 0 0 5px #c6c36f}#board img{width:92%;height:92%}#board small{position:absolute;left:3px;top:2px;color:#28351f;font-size:11px}nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}#timeline{width:100%;accent-color:#bdd09b}#caption{font-weight:600}details{border-top:1px solid #4b5144;padding-top:12px}summary{cursor:pointer}footer{color:#a5a99d;font-size:12px;margin-top:18px}#scores{color:#bdd09b}</style>
<main><h1 id="players"></h1><p id="scores"></p><div id="board" role="img" aria-label="Recorded chess position"></div><nav aria-label="Game replay"><button id="previous" aria-label="Previous move">←</button><button id="play">Play</button><button id="next" aria-label="Next move">→</button><button id="flip">Flip board</button><label><input id="coordinates" type="checkbox"> Coordinates</label></nav><label for="timeline">Recorded position</label><input id="timeline" type="range" min="0" max="${review.moves.length}" value="${selected}"><p id="caption" aria-live="polite"></p><details><summary>Recorded explanation</summary><p id="explanation"></p></details><footer id="provenance"></footer></main>
<script type="application/json" id="review-data">${json(payload)}</script>
<script>${embedPlayerScript}</script></html>`
  return { document, iframe: `<iframe title="${escape(title)}" sandbox="allow-scripts" srcdoc="${escape(document)}" style="width:100%;max-width:720px;height:1000px;border:0" loading="lazy"></iframe>` }
}

export async function createReviewEmbed(review: GameReview, options: { ply?: number; orientation?: Color; coordinates?: boolean } = {}) {
  return buildReviewEmbed(review, await pieceArtwork(), options)
}
