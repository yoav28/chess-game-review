import { act, renderHook } from '@testing-library/react';
import { Chess } from 'chess.js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useBatchStore } from '../stores/useBatchStore';
import { useBoardStore } from '../stores/useBoardStore';
import { useEvalStore } from '../stores/useEvalStore';
import { useReviewStore } from '../stores/useReviewStore';
import { useStageStore } from '../stores/useStageStore';
import { reviewId } from '../utils/reviewStorage';
import useBatchReview from './useBatchReview';
import useReviewSession from './useReviewSession';

import type { ReviewAnalysis } from '../utils/reviewStorage';

const game = new Chess();
game.loadPgn('[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *');
const pgn = game.pgn();
const otherPgn = '[White "Carol"]\n[Black "Dave"]\n\n1. d4 d5 *';

const analysis: ReviewAnalysis = {
  best3MovesWithClass: [[], [], []],
  classHistory: ['book', 'book'],
  openingNames: ['Start', 'King pawn', 'Open game'],
  cps: [0, 20, 0],
  accuracy: [99, 100],
};

beforeEach(() => {
  localStorage.clear();
  window.location.href = 'http://localhost/';

  vi.spyOn(window.history, 'replaceState').mockImplementation((_data, _unused, url) => {
    window.location.href = new URL(String(url), window.location.href).href;
  });

  vi.spyOn(window.history, 'pushState').mockImplementation((_data, _unused, url) => {
    window.location.href = new URL(String(url), window.location.href).href;
  });

  window.history.replaceState(null, '', '/');
  useReviewStore.setState({ reviews: [], storageError: null });
  useBatchStore.getState().cancel();
  useBoardStore.getState().reset();
  useEvalStore.getState().reset();
  useStageStore.getState().setStage('home');
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('a direct review URL restores saved analysis at its requested move', () => {
  const id = reviewId(pgn);
  useReviewStore.getState().save({ id, pgn, savedAt: 1, analysis });
  window.history.replaceState(null, '', `/${id}/review?move=2`);
  renderHook(useReviewSession);
  expect(useStageStore.getState().stage).toBe('review-moves');
  expect(useBoardStore.getState().currentMoveNum).toBe(2);
  expect(useEvalStore.getState().cps).toEqual([0, 20, 0]);
  expect(window.location.pathname).toBe(`/${id}/review`);
  expect(window.location.search).toBe('?move=2');
});

test('missing review URLs explain browser-local storage and can return home', () => {
  window.history.replaceState(null, '', '/missing/review?move=9');
  const { result } = renderHook(useReviewSession);
  expect(result.current.routeError).toContain('not saved in this browser');
  act(() => result.current.dismissRouteError());
  expect(window.location.pathname).toBe('/');
  expect(result.current.routeError).toBeNull();
});

test('importing a game from an unknown review URL clears its error and updates the URL', () => {
  window.history.replaceState(null, '', '/missing/review?move=9');
  const { result } = renderHook(useReviewSession);
  expect(result.current.routeError).toBeTruthy();

  act(() => {
    useBoardStore.getState().loadGame(pgn);
    useStageStore.getState().setStage('loaded');
  });

  expect(result.current.routeError).toBeNull();
  expect(window.location.pathname).toBe(`/${reviewId(pgn)}/review`);
});

test('batch saves completed review before loading and analyzing the next game', () => {
  renderHook(() => {
    useReviewSession();
    useBatchReview();
  });

  act(() => {
    useBoardStore.getState().loadGame(pgn);
    useBatchStore.getState().start([{ pgn }, { pgn: otherPgn }]);
    useStageStore.getState().setStage('loaded');
  });

  expect(useStageStore.getState().stage).toBe('reviewing');

  act(() => {
    useEvalStore.setState(analysis);
    useStageStore.getState().setStage('review-overview');
  });

  expect(useBatchStore.getState().completed).toBe(1);
  expect(useStageStore.getState().stage).toBe('reviewing');
  expect(useBoardStore.getState().currentGame.header().White).toBe('Carol');
  const saved = useReviewStore.getState().reviews.find(review => review.analysis);
  expect(saved?.analysis?.cps).toEqual([0, 20, 0]);
  expect(saved?.pgn).toContain('Alice');

  act(() => {
    useEvalStore.setState(analysis);
    useStageStore.getState().setStage('review-overview');
  });

  expect(useBatchStore.getState().completed).toBe(2);
  expect(useBatchStore.getState().active).toBe(false);
  expect(useReviewStore.getState().reviews.filter(review => review.analysis)).toHaveLength(2);
});
