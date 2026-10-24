import { create } from 'zustand';

import { readReviews, writeReviews } from '../utils/reviewStorage';

import type { SavedReview } from '../utils/reviewStorage';

interface ReviewStore {
  reviews: SavedReview[];
  storageError: string | null;
  save: (review: SavedReview) => void;
  remove: (id: string) => void;
}

export const useReviewStore = create<ReviewStore>(set => ({
  reviews: readReviews(),
  storageError: null,
  save: review => set(state => writeReviews([review, ...state.reviews.filter(item => item.id !== review.id)])),
  remove: id => set(state => writeReviews(state.reviews.filter(item => item.id !== id))),
}));
