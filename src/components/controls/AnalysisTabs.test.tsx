import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';
import AnalysisTabs from './AnalysisTabs';

beforeEach(() => {
  useSelectGameStore.getState().reset();
  useStageStore.getState().setStage('review-moves');
  useReviewViewStore.getState().setView('analysis');
  useBoardStore.getState().loadGame('1. e4 e5 *');
});

afterEach(cleanup);

test('opens recent games for the currently selected account', async () => {
  useSelectGameStore.getState().submitUsername('hikaru', 'chess.com');
  render(<AnalysisTabs />);
  await userEvent.click(screen.getByRole('button', { name: 'Games' }));
  expect(useStageStore.getState().stage).toBe('select-game');
  expect(useSelectGameStore.getState().username).toBe('hikaru');
  expect(useSelectGameStore.getState().site).toBe('chess.com');
  expect(useBoardStore.getState().currentGame.history()).toHaveLength(0);
});

test('opens the import flow when no account is selected', async () => {
  render(<AnalysisTabs />);
  await userEvent.click(screen.getByRole('button', { name: 'Games' }));
  expect(useStageStore.getState().stage).toBe('home');
});

test('keeps Analysis selected and links Explore to the actual explorer', () => {
  render(<AnalysisTabs />);
  expect(screen.getByRole('button', { name: 'Analysis' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', 'https://www.chess.com/explorer');
  expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('target', '_blank');
});
