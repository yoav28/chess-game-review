import { Chess } from 'chess.js';
import { expect, test } from 'vitest';

import getMoveTimes from './getMoveTimes';

function load(pgn: string) {
  const game = new Chess();
  game.loadPgn(pgn);

  return game;
}

test('uses each player’s previous clock and adds the Fischer increment', () => {
  const game = load('[TimeControl "300+2"]\n\n1. e4 {[%clk 0:05:01.9]} e5 {[%clk 0:05:00.8]} 2. Nf3 {[%clk 0:05:02.7]} Nc6 {[%clk 0:05:00.1]}');

  expect(getMoveTimes(game)).toEqual([0.1, 1.2, 1.2, 2.7]);
  expect(game.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
});

test('reads elapsed annotations without requiring clock metadata and prefers them over clocks', () => {
  const game = load('1. e4 {[%emt 0:00:01.25] [%clk 0:05:00]} e5 {[%emt 2.5]} 2. Nf3 {[%emt 1:02.3]} Nc6');

  expect(getMoveTimes(game)).toEqual([1.25, 2.5, 62.3, null]);
});

test('does not combine clock differences across a move with missing timing', () => {
  const game = load('[TimeControl "60"]\n\n1. e4 {[%clk 0:00:59]} e5 {[%clk 0:00:58]} 2. Nf3 Nc6 {[%clk 0:00:55]} 3. Bc4 {[%clk 0:00:55]} Bc5 {[%clk 0:00:54]} 4. d3 {[%clk 0:00:53]}');

  expect(getMoveTimes(game)).toEqual([1, 2, null, 3, null, 1, 2]);
});

test('does not invent an initial clock for a custom position starting with Black', () => {
  const game = load('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/3QK3 b - - 0 42"]\n[TimeControl "300+2"]\n\n42... Kf7 {[%clk 0:00:20]} 43. Qd7+ {[%clk 0:00:30]} Kg6 {[%clk 0:00:19]}');

  expect(getMoveTimes(game)).toEqual([null, null, 3]);
});

test('leaves clocks with unknown or multi-stage time controls unestimated', () => {
  const game = load('1. e4 {[%clk 0:00:59]} e5 {[%clk 0:00:58]} 2. Nf3 {[%clk 0:00:55]}');
  expect(getMoveTimes(game)).toEqual([null, null, null]);
  game.header('TimeControl', '40/7200:3600');
  expect(getMoveTimes(game)).toEqual([null, null, null]);
});

test('rejects invalid annotations and negative elapsed times after clock corrections', () => {
  const game = load('[TimeControl "60"]\n\n1. e4 {[%clk 0:00:61]} e5 {[%clk 0:01:02]} 2. Nf3 {[%emt -2]} Nc6 {[%clk 0:01:00]}');

  expect(getMoveTimes(game)).toEqual([null, null, null, 2]);
});

test('uses elapsed annotations to retain a known clock when a clock annotation is missing', () => {
  const game = load('[TimeControl "60+1"]\n\n1. e4 {[%emt 0.5]} e5 {[%clk 0:01:00]} 2. Nf3 {[%clk 0:01:00]}');

  expect(getMoveTimes(game)).toEqual([0.5, 1, 1.5]);
});
