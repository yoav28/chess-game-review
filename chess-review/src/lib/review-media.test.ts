import assert from 'node:assert/strict'
import test from 'node:test'
import { Script } from 'node:vm'
import { embedPlayerScript } from './embed-player'
import { reviewFixture } from '../test/review-fixture'
import { reviewImageData, reviewImageGraph } from './review-image'
import { reviewAnimationFrames } from './review-animation'
import { buildReviewEmbed } from './review-embed'
import { readFileSync } from 'node:fs'

test('image metadata keeps model, recorded depth, starting selection and imported provenance', () => {
  const review = reviewFixture()
  review.importedAt = new Date().toISOString()
  const data = reviewImageData(review, { ply: 0, orientation: 'b' })
  assert.equal(data.fen, review.initialFen)
  assert.equal(data.orientation, 'b')
  assert.match(data.model, /v2/)
  assert.equal(data.depth, 'Recorded depth 12')
  assert.match(data.provenance, /supplied in a file/)
  assert.equal(data.counts.reduce((sum, row) => sum + row.white + row.black, 0), review.moves.length)
  assert.equal(reviewImageData(review).fen, review.moves.at(-1)!.afterFen)
  delete review.accuracyVersion
  assert.match(reviewImageData(review).model, /Legacy/)
})

test('timeline preserves white-relative mate direction and stays inside its bounds', () => {
  const points = reviewImageGraph([{ cp: -10000, mate: -1 }, { cp: 0, mate: null }, { cp: 10000, mate: 1 }], 200, 100)
  assert.deepEqual(points.map(point => point.x), [0, 100, 200])
  assert.ok(points[0].y > points[1].y && points[1].y > points[2].y)
  assert.ok(points.every(point => point.y >= 8 && point.y <= 92))
})

test('animation contains the initial position and every actual move with bounded timing', () => {
  const review = reviewFixture()
  const frames = reviewAnimationFrames(review)
  assert.equal(frames.length, 5)
  assert.equal(frames[0].fen, review.initialFen)
  assert.equal(frames[4].fen, review.moves[3].afterFen)
  assert.equal(frames[1].label, '1. e4')
  assert.equal(frames[0].delay, 1400)
  assert.equal(frames[4].delay, 2500)
  assert.deepEqual(reviewAnimationFrames(review, { from: 2, to: 3, delayMs: 5000 }).map(frame => frame.ply), [2, 3])
  assert.ok(reviewAnimationFrames(review, { delayMs: 5000 }).every(frame => frame.delay <= 3000))
  review.moves[0].uci = 'a1a8'
  assert.throws(() => reviewAnimationFrames(review), /do not match/)
})

test('Chess960 replay exports the physical castled position and promotion frames', () => {
  const review = reviewFixture('[Variant "Chess960"]\n[FEN "4rkr1/4p1p1/8/8/8/8/8/5K1R w H - 0 1"]\n[Result "1-0"]\n\n1. O-O# 1-0')
  const frames = reviewAnimationFrames(review)
  assert.equal(frames.length, 2)
  assert.deepEqual(frames[1].lastMove, { from: 'f1', to: 'g1' })
  assert.match(frames[1].fen, /5RK1 b/)
  const promotion = reviewFixture('[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=N *')
  assert.match(reviewAnimationFrames(promotion)[1].fen, /^N6k/)
})

test('offline embed escapes user metadata, contains all frames, and restricts iframe privileges', () => {
  assert.doesNotThrow(() => new Script(embedPlayerScript))
  const review = reviewFixture()
  const attack = '</script><script>fetch("https://example.invalid")</script>'
  review.white = attack
  review.moves[0].explanation = attack
  review.importedAt = new Date().toISOString()
  const embed = buildReviewEmbed(review, { wk: '<svg/>' }, { ply: 1, orientation: 'b', coordinates: false })
  assert.equal((embed.document.match(/<script[ >]/g) ?? []).length, 2)
  const data = JSON.parse(embed.document.match(/id="review-data">([\s\S]*?)<\/script>/)![1])
  assert.equal(data.white, attack)
  assert.equal(data.frames[1].explanation, attack)
  assert.equal(data.frames.length, 5)
  assert.equal(data.selected, 1)
  assert.equal(data.orientation, 'b')
  assert.equal(data.coordinates, false)
  assert.equal(data.imported, true)
  assert.match(embed.iframe, /sandbox="allow-scripts"/)
  assert.match(embed.iframe, /srcdoc="&lt;!doctype/)
  assert.match(embed.document, /default-src 'none'/)
  assert.ok(!embed.document.includes(`<title>${attack}`))
})

test('three-check media retain the variant, heuristic label and terminal counters', () => {
  const review = reviewFixture(readFileSync(new URL('../test/fixtures/three-check-78864833399.pgn', import.meta.url), 'utf8'))
  const data = reviewImageData(review)
  assert.deepEqual(data.checks, { w: 2, b: 0 })
  assert.match(data.model, /uncalibrated/)
  assert.equal(reviewAnimationFrames(review).length, 53)
  const embed = buildReviewEmbed(review, {})
  const payload = JSON.parse(embed.document.match(/id="review-data">([\s\S]*?)<\/script>/)![1])
  assert.match(payload.model, /Three-check quality heuristic/)
  assert.match(payload.frames.at(-1).fen, /\+1\+3$/)
  assert.match(payload.frames.at(-1).outcome, /third check/)
  assert.doesNotThrow(() => new Script(embedPlayerScript))
})

test('Crazyhouse replay and puzzle media preserve pockets and legal drops', () => {
  const pgn = readFileSync(new URL('../test/fixtures/crazyhouse-pocket-drop.pgn', import.meta.url), 'utf8')
  const review = reviewFixture(pgn)
  const data = reviewImageData(review)
  assert.equal(data.board.pockets?.()?.b.p, 1)
  const embed = buildReviewEmbed(review, {})
  const payload = JSON.parse(embed.document.match(/id="review-data">([\s\S]*?)<\/script>/)![1])
  assert.equal(payload.frames[4].pockets.w.p, 1)
  assert.equal(payload.frames[4].pockets.b.p, 1)
  assert.match(embed.document, /drawPocket\('pocket-top'/)
  const puzzle = buildReviewEmbed(review, {}, { puzzle: true })
  const puzzlePayload = JSON.parse(puzzle.document.match(/id="review-data">([\s\S]*?)<\/script>/)![1])
  assert.doesNotThrow(() => new Script(embedPlayerScript))
  assert.equal(puzzlePayload.puzzle.expected[6], 'P@e5')
  assert.ok(puzzlePayload.puzzle.turns[6].some((move: { uci: string; drop?: string }) => move.uci === 'P@e5' && move.drop === 'p'))
  assert.ok(puzzlePayload.puzzle.turns[6].some((move: { uci: string }) => move.uci === 'P@e6'))
  assert.match(puzzle.document, /puzzleSelectDrop/)
})
