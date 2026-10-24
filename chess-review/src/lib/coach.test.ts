import test from 'node:test'
import assert from 'node:assert/strict'
import { coachText } from './coach'
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
