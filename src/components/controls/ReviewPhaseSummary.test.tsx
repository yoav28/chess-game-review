import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import ReviewPhaseSummary from './ReviewPhaseSummary';

beforeEach(() => {
  useBoardStore.getState().reset();
  useEvalStore.getState().reset();
});

afterEach(cleanup);

test('does not substitute player Elo when no moves have been analyzed', () => {
  useBoardStore.getState().loadGame('[WhiteElo "2700"]\n[BlackElo "2600"]\n\n1. e4 e5 *');
  render(<ReviewPhaseSummary />);
  expect(screen.getByLabelText('White game rating unavailable')).toHaveTextContent('—');
  expect(screen.getByLabelText('Black game rating unavailable')).toHaveTextContent('—');
  expect(screen.getByLabelText('White opening assessment unavailable')).toHaveTextContent('—');
  expect(screen.getByLabelText('Black strategy assessment unavailable')).toHaveTextContent('—');
  expect(screen.queryByText('2700')).not.toBeInTheDocument();
});

test('shows only valid explicit performance rating metadata', () => {
  useBoardStore.getState().loadGame('[WhitePerformanceRating "2450"]\n[BlackPerformanceRating "?"]\n\n1. e4 e5 *');
  render(<ReviewPhaseSummary />);
  expect(screen.getByLabelText('White game rating 2450')).toHaveTextContent('2450');
  expect(screen.getByLabelText('Black game rating unavailable')).toHaveTextContent('—');
});

test('shows estimated ratings and assessments from actual analyzed moves', () => {
  useBoardStore.getState().loadGame('[WhiteElo "1500"]\n[BlackElo "1400"]\n\n1. e4 d5 2. exd5 Qxd5 *');
  useEvalStore.setState({ cps: [0, 0, 0, 0, 0], classHistory: ['book', 'book', 'best', 'best'] });
  render(<ReviewPhaseSummary />);
  expect(screen.getByLabelText('White estimated game rating 2000')).toHaveTextContent('≈2000');
  expect(screen.getByLabelText('Black estimated game rating 1900')).toHaveTextContent('≈1900');
  expect(screen.getByLabelText('White opening assessment 100.0% accuracy')).toHaveAttribute('title', '100.0% accuracy across 2 moves.');
  expect(screen.getByLabelText('Black tactics assessment 100.0% accuracy')).toHaveAttribute('title', '100.0% accuracy across 1 move.');
  expect(screen.getByLabelText('White strategy assessment unavailable')).toHaveTextContent('—');
});
