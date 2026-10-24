import test from 'node:test'
import assert from 'node:assert/strict'
import { accuracySource, moveAccuracy, winningChance, winningChanceLoss } from './accuracy'

test('published win-chance calibration uses centipawns and is symmetric for White and Black', () => {
  assert.equal(winningChance({ cp: 0, mate: null }), 50)
  assert.ok(Math.abs(winningChance({ cp: 100, mate: null }) - 59.102589719161294) < 1e-10)
  assert.ok(Math.abs(winningChance({ cp: -100, mate: null }, 'b') - 59.102589719161294) < 1e-10)
  assert.equal(winningChance({ cp: 100000, mate: null }), 100)
  assert.ok(winningChance({ cp: -100000, mate: null }) < 1e-100)
  assert.equal(accuracySource, 'https://lichess.org/page/accuracy')
})

test('move accuracy follows the published exponential loss curve and clamps within zero and one hundred', () => {
  assert.equal(moveAccuracy(0), 100)
  assert.equal(moveAccuracy(-10), 100)
  assert.equal(moveAccuracy(10), 63.6)
  assert.equal(moveAccuracy(100), 0)
  assert.equal(moveAccuracy(2000), 0)
  assert.ok(moveAccuracy(5) > moveAccuracy(10))
  assert.throws(() => moveAccuracy(NaN), /finite/)
})

test('forced mate winning chances use the winner rather than arithmetic on encoded pawn scores', () => {
  assert.equal(winningChance({ cp: 99994, mate: 6 }), 100)
  assert.equal(winningChance({ cp: -99994, mate: -6 }), 0)
  assert.equal(winningChance({ cp: 1, mate: 6 }), 100)
  assert.equal(winningChance({ cp: -1, mate: -6 }, 'b'), 100)
  assert.equal(winningChance({ cp: 100000, mate: 0 }), 100)
  assert.equal(winningChance({ cp: -100000, mate: 0 }), 0)
  assert.equal(winningChance({ cp: -100000, mate: 0 }, 'b'), 100)
  assert.throws(() => winningChance({ cp: 0, mate: 0 }), /winning side/)
})

test('mate six to a persistent 8.29-pawn advantage retains contextual accuracy rather than scoring zero', () => {
  const before = { cp: 99994, mate: 6 }
  const after = { cp: 829, mate: null }
  const loss = winningChanceLoss(before, after, 'w')
  assert.ok(Math.abs(loss - 4.511206244481713) < 1e-10)
  assert.equal(moveAccuracy(loss), 81.6)
  assert.equal(winningChanceLoss({ cp: -99994, mate: -6 }, { cp: -829, mate: null }, 'b'), loss)
})

test('identical pawn losses have different impact in equal, winning and already lost positions', () => {
  const equal = winningChanceLoss({ cp: 0, mate: null }, { cp: -100, mate: null }, 'w')
  const winning = winningChanceLoss({ cp: 1500, mate: null }, { cp: 1400, mate: null }, 'w')
  const lost = winningChanceLoss({ cp: -1400, mate: null }, { cp: -1500, mate: null }, 'w')
  assert.ok(equal > 9)
  assert.ok(winning < 0.2)
  assert.ok(Math.abs(winning - lost) < 1e-10)
  assert.ok(moveAccuracy(winning) > moveAccuracy(equal))
  assert.equal(winningChanceLoss({ cp: 0, mate: null }, { cp: 100, mate: null }, 'w'), 0)
})
