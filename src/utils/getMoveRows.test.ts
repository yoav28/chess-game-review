import { Chess } from 'chess.js';
import { expect, test } from 'vitest';

import getMoveRows from './getMoveRows';

test('preserves the move number and correct columns when a custom position starts with Black', () => {
  const game = new Chess('4k3/8/8/8/8/8/8/3QK3 b - - 0 42');
  game.move('Kf7');
  game.move('Qd7+');
  const rows = getMoveRows(game.history({ verbose: true }));
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ number: 42, black: { index: 0, move: { san: 'Kf7' } } });
  expect(rows[0].white).toBeUndefined();
  expect(rows[1]).toMatchObject({ number: 43, white: { index: 1, move: { san: 'Qd7+' } } });
});

test('pairs ordinary games in their original order', () => {
  const game = new Chess();
  game.move('e4');
  game.move('e5');
  expect(getMoveRows(game.history({ verbose: true }))).toMatchObject([{ number: 1, white: { index: 0 }, black: { index: 1 } }]);
});
