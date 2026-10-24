import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { reviewId } from '../../utils/reviewStorage';
import ReviewFavoriteButton from './ReviewFavoriteButton';

beforeEach(() => {
  localStorage.clear();
  useBoardStore.getState().loadGame('1. e4 e5 *');
});

afterEach(cleanup);

test('persists a favorite for this review and allows removing it after remounting', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<ReviewFavoriteButton />);
  await user.click(screen.getByRole('button', { name: 'Favorite review' }));
  expect(screen.getByRole('button', { name: 'Remove review from favorites' })).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse(localStorage.getItem('game-review:favorites:v1')!)).toContain(reviewId(useBoardStore.getState().currentGame.pgn()));
  unmount();
  render(<ReviewFavoriteButton />);
  await user.click(screen.getByRole('button', { name: 'Remove review from favorites' }));
  expect(screen.getByRole('button', { name: 'Favorite review' })).toHaveAttribute('aria-pressed', 'false');
  expect(localStorage.getItem('game-review:favorites:v1')).toBe('[]');
});
