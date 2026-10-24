import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import ReviewAllStats from './ReviewAllStats';

afterEach(cleanup);

test('opens actual engine counts separated by the player who made each move', async () => {
  useEvalStore.getState().reset();
  useBoardStore.getState().loadGame('[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 *');
  useEvalStore.setState({ classHistory: ['book', 'mistake', 'book'], accuracy: [98, 71] });
  render(<ReviewAllStats />);
  await userEvent.click(screen.getByRole('button', { name: 'View All Stats' }));
  const dialog = screen.getByRole('dialog', { name: 'Game Stats' });
  expect(within(dialog).getByRole('row', { name: 'Book 2 0' })).toBeInTheDocument();
  expect(within(dialog).getByRole('row', { name: 'Mistake 0 1' })).toBeInTheDocument();
  expect(within(dialog).getByRole('row', { name: 'Accuracy 98 71' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('includes phase accuracy, sample counts, and rating methodology', async () => {
  useBoardStore.getState().loadGame('[WhiteElo "1500"]\n[BlackElo "1400"]\n\n1. e4 d5 2. exd5 Qxd5 *');
  useEvalStore.setState({ cps: [0, 0, 0, 0, 0], classHistory: ['book', 'book', 'best', 'best'] });
  render(<ReviewAllStats />);
  await userEvent.click(screen.getByRole('button', { name: 'View All Stats' }));
  const dialog = screen.getByRole('dialog', { name: 'Game Stats' });
  expect(within(dialog).getByRole('row', { name: 'Game Rating ≈2000 ≈1900' })).toBeInTheDocument();
  expect(within(dialog).getByRole('row', { name: /Tactics 100.0% 1 move 0.0% avg. win-chance loss/ })).toBeInTheDocument();
  expect(within(dialog).getByText(/Ratings marked ≈ are experimental performance estimates/)).toBeVisible();
});
