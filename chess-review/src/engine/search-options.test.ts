import assert from 'node:assert/strict'
import test from 'node:test'
import { analysisTimeLimit, engineThreads, searchCommand } from './search-options'
import { parseInfo } from './protocol'
import { searchResult } from './search-results'
import { Chess } from 'chess.js'

test('review budgets, time-only budgets and continuous search issue distinct UCI commands', () => {
  assert.deepEqual(searchCommand({ depth: 12, timeMs: 150 }), { command: 'go depth 12 movetime 150', timeout: 30000 })
  assert.deepEqual(searchCommand({ limit: 'time', depth: 4, timeMs: 30000 }), { command: 'go movetime 30000', timeout: 120000 })
  assert.deepEqual(searchCommand({ limit: 'continuous', depth: 4, timeMs: 30 }), { command: 'go infinite', timeout: null })
  assert.equal(searchCommand({ timeMs: NaN, depth: Infinity }).command, 'go depth 16 movetime 500')
  assert.equal(searchCommand({ timeMs: 100000, depth: 100 }).command, 'go depth 24 movetime 30000')
})

test('saved time and thread choices are finite, bounded and explicit', () => {
  assert.equal(analysisTimeLimit(0), 0)
  assert.equal(analysisTimeLimit(30000), 30000)
  for (const value of [null, NaN, Infinity, '0', -1, 120000]) assert.equal(analysisTimeLimit(value), 5000)
  assert.equal(engineThreads(100), 8)
  assert.equal(engineThreads(0), 1)
  assert.equal(engineThreads(2.8), 3)
  for (const value of [undefined, Infinity, '4']) assert.equal(engineThreads(value), 1)
})

test('streamed results reject illegal continuations and never mix MultiPV depths', () => {
  const fen = new Chess().fen()
  const records = [
    'info depth 10 multipv 1 score cp 30 pv e2e4 e7e5',
    'info depth 10 multipv 2 score cp 20 pv d2d4 d7d5',
    'info depth 11 multipv 1 score cp 55 pv g1f3 d7d5',
    'info depth 11 multipv 2 score cp 20 pv e2e5 e7e5',
  ].map(line => parseInfo(line, fen)!)
  const result = searchResult(fen, 'chess', records, 2)!
  assert.equal(result.depth, 10)
  assert.deepEqual(result.lines.map(line => line.depth), [10, 10])
  assert.equal(result.bestMoveSan, 'e4')
  assert.equal(searchResult(fen, 'chess', records.slice(-1), 1), null)
})

test('candidate lines sharing the same first move do not become duplicate alternatives', () => {
  const fen = new Chess().fen()
  const records = [
    'info depth 10 multipv 1 score cp 30 pv e2e4 e7e5',
    'info depth 10 multipv 2 score cp 20 pv e2e4 c7c5',
  ].map(line => parseInfo(line, fen)!)
  const result = searchResult(fen, 'chess', records, 2)!
  assert.equal(result.bestMove, 'e2e4')
  assert.deepEqual(result.lines.map(line => line.pv[0]), ['e2e4'])
})
