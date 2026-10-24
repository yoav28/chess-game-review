import { useEffect } from 'react';

import { useBatchStore } from '../stores/useBatchStore';
import { useBoardStore } from '../stores/useBoardStore';
import { useSelectGameStore } from '../stores/useSelectGameStore';
import { useStageStore } from '../stores/useStageStore';
import { useStockfishOutputStore } from '../stores/useStockfishOutputStore';

export default function useBatchReview() {
  const active = useBatchStore(state => state.active);
  const stage = useStageStore(state => state.stage);

  useEffect(() => {
    if (!active)
      return;

    if (stage === 'loaded') {
      useStockfishOutputStore.getState().review();
    }
    else if (stage === 'review-overview') {
      useBatchStore.getState().advance();
      const next = useBatchStore.getState().queue[0];
      if (!next)
        return;

      try {
        const selection = useSelectGameStore.getState();
        if (next.username && next.site)
          selection.submitUsername(next.username, next.site);
        selection.submitGame(next.game);
        useBoardStore.getState().loadGame(next.pgn);
        useStageStore.getState().setStage('loaded');
      }
      catch (error) {
        useBatchStore.getState().fail(error instanceof Error ? error.message : 'The next game could not be loaded.');
      }
    }
    else if (stage === 'home' || stage === 'select-game') {
      useBatchStore.getState().cancel();
    }
  }, [active, stage]);
}
