import { Chess } from 'chess.js';
import { expect, test } from 'vitest';

import { getAdvancedStats } from './getAdvancedStats';

import type { Classification } from './classify';

function load(pgn: string) {
  const game = new Chess();
  game.loadPgn(pgn);

  return game;
}

test('leaves unanalysed moves and invalid evaluations unavailable', () => {
  const game = load('1. e4 e5 2. Nf3 Nc6');
  const [white, black] = getAdvancedStats(game, [0, Number.NaN, 0, Number.POSITIVE_INFINITY, 0], []);

  expect(white).toMatchObject({ rating: null, ratingSource: null, accuracy: null, moveCount: 0 });
  expect(black.phases.Opening).toEqual({ accuracy: null, moveCount: 0, averageLoss: null });
  expect(getAdvancedStats(game, [0, 0], [])[0].moveCount).toBe(1);
  expect(getAdvancedStats(game, [0, 'unknown', 0], [])[1].accuracy).toBeNull();
});

test('uses actual mover colors for custom positions starting with Black', () => {
  const game = load('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/3QK3 b - - 0 42"]\n\n42... Kf7 43. Qd7+ Kg6');
  const [white, black] = getAdvancedStats(game, [0, 100, 100, 100], []);

  expect(white.accuracy).toBe(100);
  expect(black.accuracy).toBeLessThan(100);
  expect(white.moveCount).toBe(1);
  expect(black.moveCount).toBe(2);
  expect(white.phases.Opening.moveCount).toBe(0);
  expect(black.phases.Opening.moveCount).toBe(0);
  expect(white.phases.Tactics.moveCount).toBe(1);
  expect(black.phases.Strategy.moveCount).toBe(2);
});

test('prefers valid performance metadata and estimates only with a rated Elo', () => {
  const game = load('[WhiteElo "1500"]\n[BlackElo "?"]\n[WhitePerformanceRating "2234"]\n[BlackPerformanceRating "NaN"]\n\n1. e4 e5');
  let [white, black] = getAdvancedStats(game, [0, 0, 0], []);

  expect(white).toMatchObject({ rating: 2234, ratingSource: 'metadata' });
  expect(black).toMatchObject({ rating: null, ratingSource: null });
  game.header('WhitePerformanceRating', '-1', 'BlackPerformanceRating', 'Infinity', 'BlackElo', '1200');
  [white, black] = getAdvancedStats(game, [0, 0, 0], []);
  expect(white).toMatchObject({ rating: 2000, ratingSource: 'estimate' });
  expect(black).toMatchObject({ rating: 1700, ratingSource: 'estimate' });
  game.header('WhiteElo', '0', 'BlackElo', 'Infinity');
  expect(getAdvancedStats(game, [0, 0, 0], []).map(side => side.rating)).toEqual([null, null]);
});

test('bounds estimates without changing explicit metadata', () => {
  const game = load('[WhiteElo "3100"]\n[BlackElo "100"]\n\n1. e4 e5');
  const [white, black] = getAdvancedStats(game, [0, 0, 10000], []);

  expect(white.rating).toBe(3200);
  expect(black.rating).toBe(100);
  game.header('WhitePerformanceRating', '4000');
  expect(getAdvancedStats(game, [], [])[0].rating).toBe(4000);
});

test('excludes forced moves from every quality assessment', () => {
  const game = load('1. e4 e5 2. Nf3 Nc6');
  const [white, black] = getAdvancedStats(game, [0, -1000, -1000, -1000, -1000], ['forced']);

  expect(white).toMatchObject({ accuracy: 100, moveCount: 1 });
  expect(white.phases.Opening.moveCount).toBe(1);
  expect(black.moveCount).toBe(2);
  const onlyMove = load('[SetUp "1"]\n[FEN "7k/7R/6K1/8/8/8/8/8 b - - 0 1"]\n\n1... Kg8');
  expect(getAdvancedStats(onlyMove, [0, 0], [])[1].moveCount).toBe(0);
});

test('separates opening and quiet strategy while retaining overlapping tactics', () => {
  const game = load('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. O-O Nf6 6. d3 Bd6 7. Nc3 O-O 8. Bg5 h6 9. Bh4 Re8 10. Qd2 Be6 11. Rad1 Qd7 12. Bxf6 gxf6');
  const classes: Classification[] = Array.from({ length: 24 }, () => 'good');
  classes[2] = 'great';
  classes[21] = 'brilliant';
  const [white, black] = getAdvancedStats(game, Array.from({ length: 25 }, () => 0), classes);

  expect(white.phases.Opening.moveCount).toBe(10);
  expect(black.phases.Opening.moveCount).toBe(10);
  expect(white.phases.Tactics.moveCount).toBe(3);
  expect(black.phases.Tactics.moveCount).toBe(3);
  expect(white.phases.Strategy.moveCount).toBe(1);
  expect(black.phases.Strategy.moveCount).toBe(0);
});

test('quality falls with win-probability loss and handles mate and final results', () => {
  const game = load('[WhiteElo "1500"]\n\n1. e4');
  const perfect = getAdvancedStats(game, [0, 0], [])[0];
  const inaccurate = getAdvancedStats(game, [0, -100], [])[0];
  const losing = getAdvancedStats(game, [0, -1000], [])[0];

  expect(perfect.accuracy).toBe(100);
  expect(inaccurate.accuracy!).toBeGreaterThan(losing.accuracy!);
  expect(inaccurate.rating!).toBeGreaterThan(losing.rating!);
  expect(inaccurate.phases.Opening.averageLoss).toBeLessThan(losing.phases.Opening.averageLoss!);
  expect(getAdvancedStats(game, ['+M3', '1-0'], [])[0].accuracy).toBe(100);
  expect(getAdvancedStats(game, ['+M3', '-M2'], [])[0].phases.Opening.averageLoss).toBe(100);
  expect(getAdvancedStats(game, [0, '1/2-1/2'], [])[0].accuracy).toBe(100);
});
