import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import ReviewMoveList from './ReviewMoveList';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useBoardStore.getState().loadGame('[TimeControl "300"]\n\n1. Nf3 {[%clk 0:04:59.9]} Nc6 {[%clk 0:04:58.1]} 2. d4 {[%clk 0:04:58.7]} *');
  useEvalStore.setState({ classHistory: ['book', 'great', 'excellent'] });
});

afterEach(cleanup);

test('shows classifications before notation and both players’ actual move times', () => {
  render(<ReviewMoveList />);
  const rows = screen.getAllByRole('listitem');
  const whiteMove = within(rows[0]).getByRole('button', { name: 'Nf3 (book)' });
  expect(within(whiteMove).getByRole('img', { name: 'Book' })).toBeInTheDocument();
  expect(within(rows[0]).getByLabelText('White spent 0.1 seconds')).toBeInTheDocument();
  expect(within(rows[0]).getByLabelText('Black spent 1.9 seconds')).toBeInTheDocument();
  expect(within(rows[1]).getByRole('button', { name: 'd4' })).not.toHaveAttribute('data-classification');
});

test('selecting a move updates the board position and selected notation', async () => {
  render(<ReviewMoveList />);
  await userEvent.click(screen.getByRole('button', { name: 'Nc6 (great)' }));
  expect(useBoardStore.getState().currentMoveNum).toBe(2);
  expect(screen.getByRole('button', { name: 'Nc6 (great)' })).toHaveAttribute('aria-current', 'step');
});

test('omits timing data for games without clocks', () => {
  useBoardStore.getState().loadGame('1. e4 e5 *');
  render(<ReviewMoveList />);
  expect(screen.queryByLabelText(/spent/)).not.toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(2);
});
