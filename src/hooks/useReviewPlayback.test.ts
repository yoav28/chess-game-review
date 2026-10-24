import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useBoardStore } from '../stores/useBoardStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useStageStore } from '../stores/useStageStore';
import { useVariationStore } from '../stores/useVariationStore';
import useReviewPlayback from './useReviewPlayback';

beforeEach(() => {
  vi.useFakeTimers();
  useBoardStore.getState().loadGame('1. e4 e5 2. Nf3 Nc6 *');
  useStageStore.getState().setStage('review-moves');
  useVariationStore.getState().reset();
  useSettingsStore.getState().chooseAutoplayInterval(1);
});

afterEach(() => {
  vi.useRealTimers();
});

test('plays one move per interval, pauses, and stops at the final move', () => {
  const { result } = renderHook(useReviewPlayback);
  act(() => result.current.togglePlayback());
  act(() => vi.advanceTimersByTime(1000));
  expect(useBoardStore.getState().currentMoveNum).toBe(1);
  act(() => result.current.pausePlayback());
  act(() => vi.advanceTimersByTime(2000));
  expect(useBoardStore.getState().currentMoveNum).toBe(1);
  act(() => result.current.togglePlayback());
  act(() => vi.advanceTimersByTime(3000));
  expect(useBoardStore.getState().currentMoveNum).toBe(4);
  expect(result.current.isPlaying).toBe(false);
});

test('honors playback settings and cancels the timer on unmount', () => {
  useSettingsStore.getState().chooseAutoplayInterval(2);
  const { result, unmount } = renderHook(useReviewPlayback);
  act(() => result.current.togglePlayback());
  act(() => vi.advanceTimersByTime(1000));
  expect(useBoardStore.getState().currentMoveNum).toBe(0);
  act(() => vi.advanceTimersByTime(1000));
  expect(useBoardStore.getState().currentMoveNum).toBe(1);
  unmount();
  act(() => vi.advanceTimersByTime(4000));
  expect(useBoardStore.getState().currentMoveNum).toBe(1);
});
