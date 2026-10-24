import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePgn } from './game'
import { moveTimes, parseMoveTimeControl } from './move-time'

test('elapsed time subtracts each post-move clock from the same player’s prior clock plus increment', () => {
  const parsed = parsePgn('[TimeControl "180+2"]\n\n1. e4 {[%clk 0:03:01.5]} e5 {[%clk 0:03:00]} 2. Nf3 {[%clk 0:02:59.25]} Nc6 {[%clk 0:02:58]} *')
  assert.deepEqual(moveTimes(parsed), [0.5, 2, 4.25, 4])
  assert.deepEqual(moveTimes(parsed, '180'), [null, 0, 2.25, 2])
})

test('zero and fractional elapsed times remain valid without rounding to whole seconds', () => {
  const parsed = parsePgn('1. e4 {[%clk 0:05:00]} e5 {[%clk 0:04:59.99]} 2. Nf3 {[%clk 0:04:59.125]} *')
  assert.deepEqual(moveTimes(parsed, '300'), [0, 0.01, 0.875])
  assert.deepEqual(parseMoveTimeControl('0+2'), { initialSeconds: 0, incrementSeconds: 2 })
})

test('missing clocks break that player’s interval rather than attributing several moves to one', () => {
  const parsed = parsePgn('1. e4 {[%clk 0:04:58]} e5 {[%clk 0:04:59]} 2. Nf3 Nc6 {[%clk 0:04:57]} 3. Bc4 {[%clk 0:04:50]} Bc5 {[%clk 0:04:54]} 4. d3 {[%clk 0:04:47]} *')
  assert.deepEqual(moveTimes(parsed, '300'), [2, 1, null, 2, null, 3, 3])
})

test('daily, unknown, staged and malformed time controls do not manufacture elapsed times', () => {
  const parsed = parsePgn('1. e4 {[%clk 0:04:58]} e5 {[%clk 0:04:59]} *')
  for (const control of ['', '-', '?', '0', '1/259200', '40/7200:3600', '300-2', '-300', '300+NaN', 'Infinity', '300+2junk', ' 300', '9007199254740992']) {
    assert.equal(parseMoveTimeControl(control), null)
    assert.deepEqual(moveTimes(parsed, control), [null, null])
  }
  assert.deepEqual(moveTimes(parsed, '300', 'daily'), [null, null])
  assert.deepEqual(moveTimes(parsed, '300', 'DAILY'), [null, null])
})

test('custom setup positions need two observed clocks per side before timing can be known', () => {
  const parsed = parsePgn('[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 14"]\n\n14... e5 {[%clk 0:01:00]} 15. e4 {[%clk 0:01:20]} Nc6 {[%clk 0:00:58]} 16. Nf3 {[%clk 0:01:17]} *')
  assert.deepEqual(moveTimes(parsed, '300+2'), [null, null, 4, 5])
})

test('clock increases beyond the increment and corrupt values stay unknown without affecting the opponent', () => {
  const parsed = parsePgn('1. e4 {[%clk 0:05:03]} e5 {[%clk 0:05:01]} 2. Nf3 {[%clk 0:05:00]} Nc6 {[%clk 0:04:59]} *')
  assert.deepEqual(moveTimes(parsed, '300+2'), [null, 1, 5, 4])
  parsed.moves[0].clockSeconds = -1
  parsed.moves[1].clockSeconds = Infinity
  assert.deepEqual(moveTimes(parsed, '300+2'), [null, null, null, null])
  parsed.moves[0].clockSeconds = NaN
  assert.equal(moveTimes(parsed, '300+2')[0], null)
})

test('a final zero clock is a usable observation and absent annotations remain unknown', () => {
  const parsed = parsePgn('1. e4 e5 {[%clk 0:00:00]} *')
  assert.deepEqual(moveTimes(parsed, '60'), [null, 60])
  assert.deepEqual(moveTimes(parsePgn('1. e4 e5 *'), '60'), [null, null])
})
