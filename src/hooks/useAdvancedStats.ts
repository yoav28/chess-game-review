import { useMemo } from 'react';

import { useBoardStore } from '../stores/useBoardStore';
import { useEvalStore } from '../stores/useEvalStore';
import { getAdvancedStats } from '../utils/getAdvancedStats';

export default function useAdvancedStats() {
  const game = useBoardStore(state => state.currentGame);
  const cps = useEvalStore(state => state.cps);
  const classifications = useEvalStore(state => state.classHistory);

  return useMemo(() => getAdvancedStats(game, cps, classifications), [game, cps, classifications]);
}
