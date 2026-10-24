import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import { useStageStore } from '../../stores/useStageStore';
import { useVariationStore } from '../../stores/useVariationStore';
import ReviewStep from './ReviewStep';

beforeEach(() => {
  useVariationStore.getState().reset();
  useBoardStore.getState().loadGame('1. e4 e5 2. Nf3 *');
  useBoardStore.getState().toMove(1);
  useStageStore.getState().setStage('review-moves');

  useEvalStore.setState({
    classHistory: ['mistake', 'best', 'excellent'],
    cps: [0, -100, 0, 0],
    openingNames: ['Starting Position', 'King’s Pawn Opening'],
    best3MovesWithClass: [[{ pv: 'd2d4', nodes: 1, multiPv: 1, eval: 10, classification: 'best' }]],
  });
});

afterEach(cleanup);

test('next advances the reviewed move and finishes at the overview', async () => {
  render(<ReviewStep />);
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(useBoardStore.getState().currentMoveNum).toBe(2);
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Finish Review' }));
  expect(useStageStore.getState().stage).toBe('review-overview');
});

test('retry returns to the position before a mistake while keeping that move’s guidance', async () => {
  render(<ReviewStep />);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(useBoardStore.getState().currentMoveNum).toBe(0);
  expect(screen.getByText(/Try a different move instead of e4/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(useBoardStore.getState().currentMoveNum).toBe(2);
});
