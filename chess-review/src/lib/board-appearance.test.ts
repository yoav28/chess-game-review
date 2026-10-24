import assert from 'node:assert/strict'
import test from 'node:test'
import { boardThemes, defaultBoardAppearance, normalizeBoardAppearance, pieceSets } from './board-appearance'
import { pieceArtwork } from './piece-artwork'
import { drawReviewBoard } from './review-board-image'
import { buildReviewEmbed } from './review-embed'
import { reviewFixture } from '../test/review-fixture'

test('appearance accepts only supported choices and migrates missing or corrupt preferences', () => {
  assert.deepEqual(normalizeBoardAppearance({ boardTheme: 'walnut', pieceSet: 'letters', coordinates: false }), { boardTheme: 'walnut', pieceSet: 'letters', coordinates: false })
  for (const input of [null, [], true, { boardTheme: '__proto__', pieceSet: 'constructor', coordinates: 'false' }, { boardTheme: '</style><script>', pieceSet: '<svg onload=alert(1)>' }]) assert.deepEqual(normalizeBoardAppearance(input), defaultBoardAppearance)
})

test('all original piece sets contain twelve self-contained and visually distinct SVGs', async () => {
  const sets = await Promise.all((Object.keys(pieceSets) as (keyof typeof pieceSets)[]).map(set => pieceArtwork(set)))
  for (const [index, artwork] of sets.entries()) {
    assert.equal(Object.keys(artwork).length, 12)
    for (const [key, svg] of Object.entries(artwork)) {
      assert.match(key, /^[wb][pnbrqk]$/)
      assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/)
      assert.match(svg, new RegExp(`data-piece-set="${Object.keys(pieceSets)[index]}"`))
      assert.ok(!/<(?:image|script)|https?:\/\/(?!www.w3.org)/.test(svg))
    }
  }
  for (const key of Object.keys(sets[0])) assert.equal(new Set(sets.map(set => set[key])).size, 3)
})

test('concurrent exports keep separate artwork caches when the selected set changes', async () => {
  const [classic, letters, classicAgain, geometric] = await Promise.all([pieceArtwork('classic'), pieceArtwork('letters'), pieceArtwork('classic'), pieceArtwork('geometric')])
  assert.equal(classic, classicAgain)
  assert.notEqual(classic, letters)
  assert.notEqual(geometric, classic)
  assert.match(letters.wk, />K<\/text>/)
  assert.ok(!classic.wk.includes('>K</text>'))
})

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

test('coordinate colors remain readable on every normal, highlighted and selected square', () => {
  for (const theme of Object.values(boardThemes)) {
    for (const [background, text] of [[theme.light, theme.lightText], [theme.dark, theme.darkText], [theme.lastLight, theme.lightText], [theme.lastDark, theme.darkText], [theme.selected, theme.lightText]]) {
      const values = [luminance(background), luminance(text)].sort((a, b) => a - b)
      assert.ok((values[1] + 0.05) / (values[0] + 0.05) >= 4.5, `${theme.label}: ${background} / ${text}`)
    }
  }
})

test('canvas exports use the chosen square colors and coordinate option', () => {
  const colors: string[] = [], labels: string[] = [], pieces: unknown[] = []
  const context = { fillStyle: '', save() {}, restore() {}, fillRect() { colors.push(this.fillStyle) }, fillText(text: string) { labels.push(text) }, drawImage(image: unknown) { pieces.push(image) } }
  const images = new Map(['w', 'b'].flatMap(color => ['p', 'n', 'b', 'r', 'q', 'k'].map(type => [color + type, {} as HTMLImageElement] as const)))
  drawReviewBoard(context as unknown as CanvasRenderingContext2D, { fen: reviewFixture().initialFen }, images, { boardTheme: 'contrast', coordinates: false })
  assert.equal(colors.length, 64)
  assert.deepEqual(new Set(colors), new Set([boardThemes.contrast.light, boardThemes.contrast.dark]))
  assert.equal(labels.length, 0)
  assert.equal(pieces.length, 32)
  drawReviewBoard(context as unknown as CanvasRenderingContext2D, { fen: reviewFixture().initialFen }, images, { boardTheme: 'walnut', coordinates: true })
  assert.equal(labels.length, 16)
})


test('replay and puzzle embeds preserve the selected palette, piece SVGs and coordinates', async () => {
  for (const puzzle of [false, true]) {
    const exported = buildReviewEmbed(reviewFixture(), await pieceArtwork('geometric'), { boardTheme: 'walnut', pieceSet: 'geometric', coordinates: false, puzzle, ply: 0 })
    const payload = JSON.parse(exported.document.match(/id="review-data">([\s\S]*?)<\/script>/)![1])
    assert.deepEqual(payload.appearance, { boardTheme: 'walnut', pieceSet: 'geometric', coordinates: false })
    assert.equal(payload.coordinates, false)
    assert.ok(exported.document.includes(`background:${boardThemes.walnut.dark}`))
    assert.match(decodeURIComponent(payload.artwork.wq), /data-piece-set="geometric"/)
    assert.equal(Boolean(payload.puzzle), puzzle)
  }
})
