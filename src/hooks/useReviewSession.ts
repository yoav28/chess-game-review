import { useEffect, useState } from 'react';

import { useBoardStore } from '../stores/useBoardStore';
import { useEvalStore } from '../stores/useEvalStore';
import { useReviewStore } from '../stores/useReviewStore';
import { useSelectGameStore } from '../stores/useSelectGameStore';
import { useStageStore } from '../stores/useStageStore';
import { useStockfishOutputStore } from '../stores/useStockfishOutputStore';
import { openReview, reviewRoute, routeMove, routeReviewId } from '../utils/reviewSession';
import { reviewId } from '../utils/reviewStorage';

export default function useReviewSession() {
  const currentGame = useBoardStore(state => state.currentGame);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const stage = useStageStore(state => state.stage);
  const [initialized, setInitialized] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    function restoreRoute() {
      const id = routeReviewId(window.location.pathname);
      setRouteError(null);

      if (!id) {
        if (window.location.pathname !== '/')
          setRouteError('This page could not be found.');
        useBoardStore.getState().reset();
        useSelectGameStore.getState().reset();
        useStageStore.getState().setStage('home');

        return;
      }

      const review = useReviewStore.getState().reviews.find(item => item.id === id);

      if (!review) {
        setRouteError('This review is not saved in this browser. Import the game to review it here.');
        useStageStore.getState().setStage('home');

        return;
      }

      openReview(review, routeMove(window.location.search, Number.MAX_SAFE_INTEGER));
    }

    restoreRoute();
    setInitialized(true);
    window.addEventListener('popstate', restoreRoute);

    return () => window.removeEventListener('popstate', restoreRoute);
  }, []);

  useEffect(() => {
    if (!initialized)
      return;

    if (['home', 'select-game', 'select-month', 'loaded'].includes(stage)) {
      useEvalStore.getState().reset();
      useStockfishOutputStore.getState().reset();
    }

    if (!['loaded', 'reviewing', 'review-overview', 'review-moves'].includes(stage))
      return;

    setRouteError(null);
    const pgn = currentGame.pgn();
    const id = reviewId(pgn);
    const previous = useReviewStore.getState().reviews.find(review => review.id === id);
    const selection = useSelectGameStore.getState();
    const finished = stage === 'review-overview' || stage === 'review-moves';
    const { best3MovesWithClass, classHistory, openingNames, cps, accuracy } = useEvalStore.getState();
    const analysis = finished ? { best3MovesWithClass, classHistory, openingNames, cps, accuracy } : previous?.analysis;

    useReviewStore.getState().save({
      id,
      pgn,
      savedAt: Date.now(),
      username: selection.username,
      site: selection.site,
      game: selection.game,
      analysis,
    });
  }, [currentGame, stage, initialized]);

  useEffect(() => {
    if (!initialized || routeError)
      return;

    if (['loaded', 'reviewing', 'review-overview', 'review-moves'].includes(stage)) {
      const id = reviewId(currentGame.pgn());
      const url = reviewRoute(id, currentMoveNum);
      if (routeReviewId(window.location.pathname) === id)
        window.history.replaceState(null, '', url);
      else
        window.history.pushState(null, '', url);
    }
    else if (window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
  }, [currentGame, currentMoveNum, stage, routeError, initialized]);

  function dismissRouteError() {
    window.history.replaceState(null, '', '/');
    setRouteError(null);
  }

  return { routeError, dismissRouteError };
}
