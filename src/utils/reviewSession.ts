import { useBatchStore } from '../stores/useBatchStore';
import { useBoardStore } from '../stores/useBoardStore';
import { useEvalStore } from '../stores/useEvalStore';
import { useSelectGameStore } from '../stores/useSelectGameStore';
import { useStageStore } from '../stores/useStageStore';
import { useStockfishOutputStore } from '../stores/useStockfishOutputStore';

import type { SavedReview } from './reviewStorage';

export function reviewRoute(id: string, move: number) {
  return `/${encodeURIComponent(id)}/review?move=${move}`;
}

export function routeReviewId(pathname: string) {
  const match = pathname.match(/^\/([^/]+)\/review\/?$/);

  return match ? match[1] : null;
}

export function routeMove(search: string, max: number) {
  const value = Number(new URLSearchParams(search).get('move'));

  return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
}

export function openReview(review: SavedReview, move = 0) {
  useBatchStore.getState().cancel();
  const selection = useSelectGameStore.getState();
  selection.reset();
  if (review.username && review.site)
    selection.submitUsername(review.username, review.site);
  selection.submitGame(review.game);
  useStockfishOutputStore.getState().reset();
  useBoardStore.getState().loadGame(review.pgn);
  useEvalStore.getState().reset();
  if (review.analysis)
    useEvalStore.setState(review.analysis);
  const board = useBoardStore.getState();
  board.toMove(Math.max(0, Math.min(board.currentGame.history().length, move)));
  useStageStore.getState().setStage(review.analysis ? 'review-moves' : 'loaded');
}
