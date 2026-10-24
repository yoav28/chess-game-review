import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import ReviewPhaseSummary from './ReviewPhaseSummary';

afterEach(cleanup);

test('does not substitute player Elo for unavailable game performance or phase scores', () => {
  render(<ReviewPhaseSummary header={{ WhiteElo: '2700', BlackElo: '2600' }} />);
  expect(screen.getByLabelText('White game rating unavailable')).toHaveTextContent('—');
  expect(screen.getByLabelText('Black game rating unavailable')).toHaveTextContent('—');
  expect(screen.getByLabelText('White opening assessment unavailable')).toHaveTextContent('—');
  expect(screen.getByLabelText('Black middlegame assessment unavailable')).toHaveTextContent('—');
  expect(screen.queryByText('2700')).not.toBeInTheDocument();
});

test('shows only valid explicit performance rating metadata', () => {
  render(<ReviewPhaseSummary header={{ WhitePerformanceRating: ' 2450 ', BlackPerformanceRating: '?' }} />);
  expect(screen.getByLabelText('White game rating 2450')).toHaveTextContent('2450');
  expect(screen.getByLabelText('Black game rating unavailable')).toHaveTextContent('—');
});
