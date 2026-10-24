import { useEffect, useState } from 'react';

import { useBoardStore } from '../stores/useBoardStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useStageStore } from '../stores/useStageStore';
import { useVariationStore } from '../stores/useVariationStore';

export default function useReviewPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const currentGame = useBoardStore(state => state.currentGame);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const reviewFinished = useStageStore(state => state.computed.reviewFinished);
  const interval = useSettingsStore(state => state.settings.autoplayInterval);
  const variationFen = useVariationStore(state => state.fen);

  useEffect(() => {
    setIsPlaying(false);
  }, [currentGame]);

  useEffect(() => {
    if (!reviewFinished || variationFen || currentMoveNum >= currentGame.history().length)
      setIsPlaying(false);
  }, [reviewFinished, variationFen, currentMoveNum, currentGame]);

  useEffect(() => {
    if (!isPlaying)
      return;

    const timer = window.setInterval(() => {
      const board = useBoardStore.getState();

      if (!useStageStore.getState().computed.reviewFinished || useVariationStore.getState().fen) {
        setIsPlaying(false);

        return;
      }

      board.toNextMove();
      useStageStore.getState().setStage('review-moves');
    }, interval * 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, interval]);

  function togglePlayback() {
    if (!reviewFinished)
      return;

    if (isPlaying) {
      setIsPlaying(false);

      return;
    }

    useVariationStore.getState().reset();
    if (currentMoveNum >= currentGame.history().length)
      useBoardStore.getState().toFirstMove();
    useStageStore.getState().setStage('review-moves');
    setIsPlaying(true);
  }

  return { isPlaying, togglePlayback, pausePlayback: () => setIsPlaying(false) };
}
