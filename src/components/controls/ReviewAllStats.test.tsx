import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import ReviewAllStats from './ReviewAllStats';

afterEach(cleanup);

test('opens actual engine counts separated by the player who made each move', async () => {
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
