import { Chess } from 'chess.js';

import type { ChessComGame, LichessGame } from '../queries/useMonthlyArchives';
import type { MoveEvalWithClass } from '../stores/useEvalStore';
import type { Site } from '../stores/useSelectGameStore';
import type { Classification } from './classify';

export interface ReviewAnalysis {
  best3MovesWithClass: MoveEvalWithClass[][];
  classHistory: Classification[];
  openingNames: string[];
  cps: (string | number)[];
  accuracy: [number, number];
}
export interface SavedReview {
  id: string;
  pgn: string;
  savedAt: number;
  username?: string;
  site?: Site;
  game?: ChessComGame | LichessGame;
  analysis?: ReviewAnalysis;
}
export const REVIEW_STORAGE_KEY = 'game-review:recent:v1';

export function reviewId(pgn: string) {
  let first = 2166136261;
  let second = 5381;

  for (const char of pgn) {
    first = Math.imul(first ^ char.charCodeAt(0), 16777619);
    second = Math.imul(second, 33) ^ char.charCodeAt(0);
  }

  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

export function readReviews(): SavedReview[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || '[]');
    if (!Array.isArray(value))
      return [];

    return value.filter((entry): entry is SavedReview => {
      if (!entry || typeof entry.id !== 'string' || typeof entry.pgn !== 'string' || typeof entry.savedAt !== 'number')
        return false;

      try {
        const chess = new Chess();
        chess.loadPgn(entry.pgn);
        const count = chess.history().length;
        const analysis = entry.analysis;

        return !analysis || (
          Array.isArray(analysis.classHistory) && analysis.classHistory.length === count
          && Array.isArray(analysis.cps) && analysis.cps.length === count + 1
          && Array.isArray(analysis.best3MovesWithClass)
          && Array.isArray(analysis.openingNames)
          && Array.isArray(analysis.accuracy) && analysis.accuracy.length === 2
        );
      }
      catch {
        return false;
      }
    }).slice(0, 100);
  }
  catch {
    return [];
  }
}

export function writeReviews(reviews: SavedReview[]) {
  const recent = reviews.slice(0, 100);

  while (recent.length) {
    try {
      localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(recent));

      return { reviews: recent, storageError: null };
    }
    catch {
      if (recent.length === 1)
        break;
      recent.pop();
    }
  }

  if (!reviews.length) {
    try {
      localStorage.removeItem(REVIEW_STORAGE_KEY);

      return { reviews: [], storageError: null };
    }
    catch {}
  }

  return { reviews, storageError: 'Browser storage is unavailable or full. This review is only available until you close the page.' };
}
