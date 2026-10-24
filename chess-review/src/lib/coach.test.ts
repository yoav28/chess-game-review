import test from 'node:test'
import assert from 'node:assert/strict'
import { coachProfiles, coachText } from './coach'
import { parsePgn, type MoveReview } from './review'

const move: MoveReview = {
  ...parsePgn('1. e4').moves[0], classification: 'good', centipawnLoss: 40, accuracy: 85,
  beforeEvaluation: { cp: 25, mate: null }, evaluation: { cp: -15, mate: null },
  bestMove: 'd2d4', bestMoveSan: 'd4', pv: ['d2d4'], pvSan: ['d4'], depth: 12,
  phase: 'opening', explanation: 'A detailed explanation from the reviewed position.',
}

test('concise coaching uses factual position details and the recorded engine alternative', () => {
  assert.match(coachText(move, 'concise'), /e4 in the center/)
  assert.match(coachText(move, 'concise'), /preferred d4/)
  assert.equal(coachText(move, 'detailed'), move.explanation)
})

test('missing engine alternatives never imply the played move was the first choice', () => {
  const text = coachText({ ...move, bestMove: null, bestMoveSan: null }, 'concise')
  assert.match(text, /No engine alternative/)
  assert.doesNotMatch(text, /follows the engine/)
})

test('presentation profiles change wording while retaining the same grounded chess fact and legal engine choice', () => {
  const clear = coachText(move, 'concise', 'clear')
  const supportive = coachText(move, 'concise', 'supportive')
  const analyst = coachText({ ...move, winningChanceLoss: 4.27 }, 'concise', 'analyst')
  assert.notEqual(clear, supportive)
  assert.notEqual(clear, analyst)
  for (const text of [clear, supportive, analyst]) {
    assert.match(text, /e4 in the center/)
    assert.match(text, /d4/)
    assert.doesNotMatch(text, /intended|planned|you wanted|guaranteed|win the game/i)
  }
  assert.match(supportive, /Compare it with d4/)
  assert.match(analyst, /Search depth 12/)
  assert.match(analyst, /4\.27 percentage points/)
})

test('profile details preserve saved explanations and avoid fabricating win-chance loss for legacy moves', () => {
  assert.equal(coachText(move, 'detailed', 'clear'), move.explanation)
  assert.ok(coachText(move, 'detailed', 'supportive').includes(move.explanation))
  assert.ok(coachText(move, 'detailed', 'analyst').includes(move.explanation))
  assert.match(coachText(move, 'concise', 'analyst'), /Recorded centipawn loss: 40/)
  assert.doesNotMatch(coachText(move, 'concise', 'analyst'), /winning-chance loss/)
  const unknown = coachText({ ...move, depth: NaN, centipawnLoss: NaN, winningChanceLoss: NaN }, 'concise', 'analyst')
  assert.doesNotMatch(unknown, /NaN|Recorded.*loss|Search depth/)
})

test('a stale saved alternative SAN is replaced by legal notation and illegal alternatives remain unavailable', () => {
  for (const profile of Object.keys(coachProfiles) as (keyof typeof coachProfiles)[]) {
    const corrected = coachText({ ...move, bestMoveSan: 'Qxf7#' }, 'concise', profile)
    assert.match(corrected, /d4/)
    assert.doesNotMatch(corrected, /Qxf7/)
    const illegal = coachText({ ...move, bestMove: 'e2e5', bestMoveSan: 'e5' }, 'concise', profile)
    assert.match(illegal, /No engine alternative/)
    assert.doesNotMatch(illegal, /preferred e5|choice.*e5/)
  }
})

test('profile speech settings use distinct bounded rates and pitch for local narration', () => {
  assert.deepEqual(Object.keys(coachProfiles), ['clear', 'supportive', 'analyst'])
  assert.equal(new Set(Object.values(coachProfiles).map(profile => profile.speechRate)).size, 3)
  for (const profile of Object.values(coachProfiles)) {
    assert.ok(profile.speechRate >= 0.5 && profile.speechRate <= 1.5)
    assert.ok(profile.speechPitch >= 0.5 && profile.speechPitch <= 1.5)
    assert.ok(profile.label.length > 0 && profile.description.length > 0)
  }
})
