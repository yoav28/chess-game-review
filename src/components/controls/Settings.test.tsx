import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { useSettingsStore } from '../../stores/useSettingsStore';
import Settings from './Settings';

const initialSettings = useSettingsStore.getState().settings;

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ settings: initialSettings });
});

afterEach(() => {
  cleanup();
  useSettingsStore.setState({ settings: initialSettings });
  localStorage.clear();
});

test('supports keyboard category navigation and saves settings across categories', async () => {
  const user = userEvent.setup();
  render(<Settings />);
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Settings');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Chess Engine' }), 'classical');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Analysis Depth' }), '18');
  await user.click(screen.getByRole('tab', { name: 'Engine' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Interface' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Interface' })).toHaveAttribute('aria-selected', 'true');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Playback Interval' }), '2');
  await user.click(screen.getByRole('checkbox', { name: 'Show Ratings' }));
  await user.click(screen.getByRole('tab', { name: 'Interface' }));
  await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Board' })).toHaveFocus();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Board Theme' }), 'brown');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Pieces' }), 'classic');
  expect(useSettingsStore.getState().settings).toMatchObject({ analysisModel: 'classical', analysisDepth: 18, autoplayInterval: 2, board: 'brown', pieces: 'classic', showRatings: !initialSettings.showRatings });
  expect(localStorage.getItem('analysisModel')).toBe('classical');
  expect(localStorage.getItem('analysisDepth')).toBe('18');
  expect(localStorage.getItem('autoplayInterval')).toBe('2');
  expect(localStorage.getItem('board')).toBe('brown');
  await user.click(screen.getByRole('tab', { name: 'Board' }));
  await user.keyboard('{Home}');
  expect(screen.getByRole('combobox', { name: 'Chess Engine' })).toHaveValue('classical');
  expect(screen.getByRole('combobox', { name: 'Analysis Depth' })).toHaveValue('18');
});

test('closes with Escape or the close button and returns focus to Settings', async () => {
  const user = userEvent.setup();
  render(<Settings />);
  const trigger = screen.getByRole('button', { name: 'Settings' });
  await user.click(trigger);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});
