import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { demoGame } from './demo'
import { engineRules, formatClock, gameFromPgn, gameMoveCount, parseGame, parsePgn } from './game'
import { readFileSync } from 'node:fs'

test('the demo is a complete legal mating game with castling and a queen sacrifice', () => {
  const parsed = parseGame(demoGame)
  assert.equal(parsed.moves.length, 33)
  assert.equal(parsed.positions.length, 34)
  assert.equal(parsed.moves.at(-1)?.san, 'Rd8#')
  assert.equal(new Chess(parsed.positions.at(-1)).isCheckmate(), true)
  assert.equal(parsed.moves.find((move) => move.san === 'O-O-O')?.uci, 'e1c1')
  assert.equal(parsed.result, '1-0')
  assert.equal(demoGame.white.result, 'win')
})

test('PGN setup positions preserve black to move, move number, and promotion', () => {
  const parsed = parsePgn(`[SetUp "1"]
[FEN "8/8/8/8/8/8/1p6/4K2k b - - 0 42"]
[Result "*"]

42... b1=Q+ {[%clk 0:01:02.5]} 43. Kf2 *`)
  assert.equal(parsed.initialFen, '8/8/8/8/8/8/1p6/4K2k b - - 0 42')
  assert.equal(parsed.moves[0].color, 'b')
  assert.equal(parsed.moves[0].uci, 'b2b1q')
  assert.equal(parsed.moves[0].promotion, 'q')
  assert.equal(parsed.moves[0].clockSeconds, 62.5)
  assert.equal(parsed.positions.length, 3)
})

test('mainline clocks stay aligned through variations, NAGs and repeated positions', () => {
  const parsed = parsePgn(`[Result "*"]

1.Nf3 {[%clk 0:05:00]} (1. e4 {[%clk 0:00:01]} e5) 1...Nf6 {[%clk 0:04:59]}
2. Ng1 $2 {[%clk 0:04:57]} Ng8 {[%clk 0:04:56]}
3. Nf3 {[%clk 0:04:55]} *`)
  assert.deepEqual(parsed.clocks, [300, 299, 297, 296, 295])
  assert.equal(parsed.moves[4].clockSeconds, 295)
})

test('en passant moves include the actual capture information', () => {
  const parsed = parsePgn('1. e4 a6 2. e5 d5 3. exd6 *')
  assert.equal(parsed.moves.at(-1)?.captured, 'p')
  assert.equal(parsed.moves.at(-1)?.flags.includes('e'), true)
  assert.equal(new Chess(parsed.positions.at(-1)).get('d5'), undefined)
})

test('invalid PGNs and unsupported variants return actionable errors', () => {
  assert.throws(() => parsePgn(''), /empty/)
  assert.throws(() => parsePgn('1. e4 e5 2. Qxe8 *'), /Cannot read this PGN/)
  assert.throws(() => parseGame({ ...demoGame, rules: 'bughouse' }), /Crazyhouse/)
})

test('Chess960 PGN import preserves variant, clocks, headers and physical castle destinations', () => {
  const pgn = '[Variant "Chess960"]\n[FEN "4k3/8/8/8/8/8/8/5KR1 w G - 0 1"]\n[White "Ada"]\n[Black "Grace"]\n\n1. O-O {[%clk 0:03:00]} *'
  const game = gameFromPgn(pgn)
  assert.equal(game.rules, 'chess960')
  const parsed = parseGame(game)
  assert.equal(parsed.variant, 'chess960')
  assert.equal(parsed.headers.White, 'Ada')
  assert.equal(parsed.moves[0].uci, 'f1g1')
  assert.equal(parsed.moves[0].kingTo, 'g1')
  assert.equal(parsed.moves[0].rookTo, 'f1')
  assert.equal(parsed.clocks[0], 180)
  assert.throws(() => parseGame({ ...game, rules: 'chess' }), /cannot use standard/)
})

test('imported PGN keeps player names, ratings, result, and stable IDs', () => {
  const pgn = '[White "Ada"]\n[Black "Grace"]\n[WhiteElo "1500"]\n[Date "2025.01.02"]\n[Result "1/2-1/2"]\n\n1. e4 e5 1/2-1/2'
  const game = gameFromPgn(pgn)
  assert.equal(game.white.username, 'Ada')
  assert.equal(game.white.rating, 1500)
  assert.equal(game.white.result, 'agreed')
  assert.equal(game.black.result, 'agreed')
  assert.equal(game.endTime, 1735776000)
  assert.equal(game.id, gameFromPgn(pgn).id)
  assert.equal(formatClock(62.9), '1:02')
  assert.equal(formatClock(3662), '1:01:02')
  assert.equal(formatClock(undefined), '—')
})

test('game-list move counts parse mainline moves instead of matching header dates', () => {
  const record = gameFromPgn('[Event "Open"]\n[Date "2026.10.25"]\n[White "Ada"]\n[Black "Grace"]\n\n1. e4 e5 2. Nf3 Nc6 1-0')
  assert.equal(gameMoveCount(record), 4)
  assert.equal(gameMoveCount({ ...record, pgn: 'not a valid game' }), null)
})
test('public queen-odds PGN uses its actual custom start and standard move rules', () => {
  const source = readFileSync(new URL('../test/fixtures/material-odds.pgn', import.meta.url), 'utf8')
  const game = { ...gameFromPgn(source), rules: 'oddschess' }
  const parsed = parseGame(game)
  assert.equal(engineRules(game.rules), 'chess')
  assert.equal(parsed.moves.length, 108)
  assert.equal(parsed.clocks.filter(clock => clock !== null).length, 108)
  assert.equal(parsed.result, '1/2-1/2')
  assert.equal(new Chess(parsed.initialFen).get('d1'), undefined)
  const castled = new Chess(parsed.positions[9])
  assert.equal(castled.get('c1')?.type, 'k')
  assert.equal(castled.get('d1')?.type, 'r')
  assert.equal(game.rules, 'oddschess')
})
