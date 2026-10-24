import { create } from 'zustand';

interface ReviewViewStore {
  view: 'review' | 'analysis';
  setView: (view: ReviewViewStore['view']) => void;
}

export const useReviewViewStore = create<ReviewViewStore>(set => ({
  view: 'review',
  setView: view => set({ view }),
}));
