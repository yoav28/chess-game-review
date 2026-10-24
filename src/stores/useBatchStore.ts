import { create } from 'zustand';

import type { ChessComGame, LichessGame } from '../queries/useMonthlyArchives';
import type { Site } from './useSelectGameStore';

export interface BatchEntry {
  pgn: string;
  game?: ChessComGame | LichessGame;
  username?: string;
  site?: Site;
}

interface BatchStore {
  queue: BatchEntry[];
  active: boolean;
  completed: number;
  total: number;
  error?: string;
  start: (entries: BatchEntry[]) => void;
  advance: () => void;
  cancel: () => void;
  fail: (error: string) => void;
}

export const useBatchStore = create<BatchStore>(set => ({
  queue: [],
  active: false,
  completed: 0,
  total: 0,
  start: entries => set({ queue: entries, active: entries.length > 0, completed: 0, total: entries.length, error: undefined }),
  advance: () => set(state => ({ queue: state.queue.slice(1), completed: state.completed + (state.queue.length ? 1 : 0), active: state.queue.length > 1 })),
  cancel: () => set({ active: false, queue: [] }),
  fail: error => set({ active: false, queue: [], error }),
}));
