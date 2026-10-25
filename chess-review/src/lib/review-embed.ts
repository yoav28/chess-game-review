import type { Color } from 'chess.js'
import type { GameReview } from './review'
import { reviewAnimationFrames } from './review-animation'
import { pieceArtwork } from './piece-artwork'
import { embedPlayerScript } from './embed-player'
import { createPosition } from './position'
import { isVariantHeuristic, variantLabel } from './variants'
import { positionOutcome } from './play-position'
import { embedPuzzleData } from './embed-puzzle'
import { boardThemes, normalizeBoardAppearance, type BoardAppearance } from './board-appearance'

export type ReviewEmbedOptions = Partial<BoardAppearance> & { ply?: number; orientation?: Color; puzzle?: boolean }

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export function buildReviewEmbed(review: GameReview, artwork: Record<string, string>, options: ReviewEmbedOptions = {}) {
  const frames = reviewAnimationFrames(review)
  const appearance = normalizeBoardAppearance(options)
  const theme = boardThemes[appearance.boardTheme]
  const selected = Number.isFinite(options.ply) ? Math.max(0, Math.min(review.moves.length, Math.round(options.ply!))) : options.puzzle ? 0 : review.moves.length
  const payload = {
    white: review.white, black: review.black, result: review.result, imported: Boolean(review.importedAt),
    model: review.variant && isVariantHeuristic(review.variant) ? `${variantLabel(review.variant)} quality heuristic v2 (uncalibrated)` : review.accuracyVersion === 2 ? 'Win-chance accuracy v2' : 'Legacy accuracy v1', whiteAccuracy: review.whiteAccuracy, blackAccuracy: review.blackAccuracy,
    frames: frames.map(frame => {
      const board = createPosition(frame.fen, review.variant)
      return { ...frame, pockets: board.pockets?.() ?? null, outcome: positionOutcome(board), explanation: frame.ply ? review.moves[frame.ply - 1].explanation : 'Before the first recorded move.' }
    }),
    artwork: Object.fromEntries(Object.entries(artwork).filter(([key]) => /^[wb][pnbrqk]$/.test(key)).map(([key, svg]) => [key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`])),
    selected, orientation: options.orientation ?? 'w', coordinates: appearance.coordinates, appearance,
    puzzle: options.puzzle ? embedPuzzleData(review, selected) : null,
  }
  const title = `${review.white} vs ${review.black} · Open File`
  const document = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>${escape(title)}</title>
<style>body{margin:0;background:#20221f;color:#eeeede;font:15px system-ui,sans-serif}main{max-width:680px;margin:auto;padding:18px}h1{font-size:20px;margin:0 0 8px}p{line-height:1.6}button,input{font:inherit}button{background:#3a3e35;color:inherit;border:1px solid #68745b;border-radius:4px;padding:8px 12px;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #bdd09b}button:disabled{opacity:.4}#board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;max-width:640px}#board>div,#board>button{position:relative;display:grid;place-items:center;min-width:0;background:${theme.light}}#board>button{border:0;border-radius:0;padding:0;aspect-ratio:1;opacity:1}#board>button:focus-visible{outline:3px solid #20221f;outline-offset:-4px;z-index:1}#board .selected{box-shadow:inset 0 0 0 5px #25695e}#board .drop-target{box-shadow:inset 0 0 0 5px #bdd09b}#choices{display:flex;gap:8px;flex-wrap:wrap}#choices:empty,#pocket-top:empty,#pocket-bottom:empty{display:none}[hidden]{display:none!important}#board .dark{background:${theme.dark}}#board .last{background:${theme.lastLight}}#board .dark.last{background:${theme.lastDark}}#board img{width:92%;height:92%}#board small{position:absolute;left:3px;top:2px;color:${theme.lightText};font-size:11px}#board .dark small{color:${theme.darkText}}.pocket{display:flex;align-items:center;gap:8px;min-height:42px;padding:2px 6px;background:#3a3e35;border-radius:3px}.pocket-piece{position:relative;width:34px;height:34px;border:0;padding:2px;background:transparent}.pocket-piece img{width:100%;height:100%}.pocket-piece span{position:absolute;right:0;bottom:0;font-size:10px;font-weight:700}nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}#timeline{width:100%;accent-color:#bdd09b}#caption{font-weight:600}details{border-top:1px solid #4b5144;padding-top:12px}summary{cursor:pointer}footer{color:#a5a99d;font-size:12px;margin-top:18px}#scores{color:#bdd09b}</style>
<main><h1 id="players"></h1><p id="scores"></p><div id="pocket-top" class="pocket" aria-label="Pocket"></div><div id="board" role="group" aria-label="Recorded chess position"></div><div id="pocket-bottom" class="pocket" aria-label="Pocket"></div><nav aria-label="Board controls"><button id="flip">Flip board</button><label><input id="coordinates" type="checkbox"> Coordinates</label></nav><nav id="replay-controls" aria-label="Game replay"><button id="previous" aria-label="Previous move">←</button><button id="play">Play</button><button id="next" aria-label="Next move">→</button></nav><section id="puzzle-controls" hidden aria-label="Guess the game"><p>Guess the recorded moves. Other good moves may differ from this game.</p><nav aria-label="Puzzle controls"><button id="hint">Hint</button><button id="solution">Show solution</button><button id="reset">Reset puzzle</button><button id="retry" hidden>Try again</button></nav><div id="choices" aria-label="Choose move"></div></section><label id="timeline-label" for="timeline">Recorded position</label><input id="timeline" type="range" min="0" max="${review.moves.length}" value="${selected}"><p id="caption" aria-live="polite"></p><p id="solution-line" hidden></p><details id="explanation-details"><summary>Recorded explanation</summary><p id="explanation"></p></details><footer id="provenance"></footer></main>
<script type="application/json" id="review-data">${json(payload)}</script>
<script>${embedPlayerScript}</script></html>`
  return { document, iframe: `<iframe title="${escape(title)}" sandbox="allow-scripts" srcdoc="${escape(document)}" style="width:100%;max-width:720px;height:1000px;border:0" loading="lazy"></iframe>` }
}

export async function createReviewEmbed(review: GameReview, options: ReviewEmbedOptions = {}) {
  return buildReviewEmbed(review, await pieceArtwork(normalizeBoardAppearance(options).pieceSet), options)
}
