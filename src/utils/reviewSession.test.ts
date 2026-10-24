import { beforeEach, expect, test, vi } from 'vitest';

import { useBoardStore } from '../stores/useBoardStore';
import { useEvalStore } from '../stores/useEvalStore';
import { useStageStore } from '../stores/useStageStore';
import { openReview, reviewRoute, routeMove, routeReviewId } from './reviewSession';
import { REVIEW_STORAGE_KEY, readReviews, reviewId, writeReviews } from './reviewStorage';

const pgn = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 *';

beforeEach(() => {
  localStorage.clear();
  useBoardStore.getState().reset();
  useStageStore.getState().setStage('home');
  vi.restoreAllMocks();
});

test('review routes clamp malformed and out of range move numbers', () => {
  expect(reviewRoute('game123', 4)).toBe('/game123/review?move=4');
  expect(routeReviewId('/game123/review')).toBe('game123');
  expect(routeReviewId('/other/page')).toBeNull();
  expect(routeMove('?move=-20', 4)).toBe(0);
  expect(routeMove('?move=99', 4)).toBe(4);
  expect(routeMove('?move=NaN', 4)).toBe(0);
});

test('saved games restore original PGN and a legal current move', () => {
  openReview({ id: reviewId(pgn), pgn, savedAt: 1 }, 99);
  expect(useBoardStore.getState().currentGame.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  expect(useBoardStore.getState().currentMoveNum).toBe(4);
  expect(useStageStore.getState().stage).toBe('loaded');
  expect(useEvalStore.getState().classHistory).toEqual([]);
});

test('storage safely ignores corrupt JSON and invalid PGNs', () => {
  localStorage.setItem(REVIEW_STORAGE_KEY, '{');
  expect(readReviews()).toEqual([]);
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify([{ id: 'bad', pgn: '1. invalid', savedAt: 1 }]));
  expect(readReviews()).toEqual([]);
  const review = { id: reviewId(pgn), pgn, savedAt: 1 };
  writeReviews([review]);
  expect(readReviews()).toEqual([review]);
});

test('storage evicts oldest reviews when browser quota is reached', () => {
  const originalSet = localStorage.setItem.bind(localStorage);

  const set = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (JSON.parse(value).length > 1)
      throw new DOMException('Full', 'QuotaExceededError');
    originalSet(key, value);
  });

  const newest = { id: 'new', pgn, savedAt: 2 };
  const result = writeReviews([newest, { id: 'old', pgn, savedAt: 1 }]);
  expect(set).toHaveBeenCalledTimes(2);
  expect(result.reviews).toEqual([newest]);
  expect(result.storageError).toBeNull();
});

test('unavailable browser storage keeps current session with a visible warning', () => {
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new DOMException('Denied', 'SecurityError');
  });

  const result = writeReviews([{ id: 'new', pgn, savedAt: 2 }]);
  expect(result.reviews).toHaveLength(1);
  expect(result.storageError).toContain('unavailable or full');
});
