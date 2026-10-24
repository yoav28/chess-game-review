import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { useVariationStore } from '../../stores/useVariationStore';
import PlayerBadge from './PlayerBadge';

vi.mock('../../queries/usePlayerCountry', () => ({ default: () => ({ data: null }) }));
vi.mock('../../queries/usePlayerProfile', () => ({ default: () => ({ data: null }) }));
vi.mock('../../hooks/useLoser', () => ({ default: () => ({ loser: null, loseBy: null }) }));

beforeEach(() => {
  useVariationStore.getState().reset();
  useBoardStore.getState().loadGame('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/3QK3 b - - 0 42"]\n[TimeControl "300"]\n[Result "*"]\n\n42... Kf7 {[%clk 0:04:58]} 43. Qd7+ {[%clk 0:04:55]} *');
});

afterEach(cleanup);

test('uses the custom initial position to show material', () => {
  render(<PlayerBadge color="w" />);
  expect(screen.getByText('+9')).toBeInTheDocument();
});

test('shows Black’s clock after a Black first move in a custom position', () => {
  useBoardStore.getState().toMove(1);
  render(<PlayerBadge color="b" />);
  expect(screen.getByText('4:58')).toBeInTheDocument();
});

test('keeps White’s initial clock before White has moved in a custom position', () => {
  useBoardStore.getState().toMove(1);
  render(<PlayerBadge color="w" />);
  expect(screen.getByText('5:00')).toBeInTheDocument();
});
