import { useBoardStore } from '../../stores/useBoardStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';
import { useVariationStore } from '../../stores/useVariationStore';
import NavigationIcon from '../NavigationIcon';

import '../../styles/analysis-tabs.css';

export default function AnalysisTabs() {
  function openGames() {
    const selection = useSelectGameStore.getState();
    useVariationStore.getState().reset();
    useBoardStore.getState().reset();

    if (selection.site && selection.username) {
      selection.submitUsername(selection.username, selection.site);
      useStageStore.getState().setStage('select-game');
    }
    else {
      selection.reset();
      useStageStore.getState().setStage('home');
    }
  }

  return (
    <nav aria-label="Analysis navigation" className="analysis-tabs">
      <button
        aria-current="page"
        onClick={() => {
          useReviewViewStore.getState().setView('analysis');
          useStageStore.getState().setStage('review-moves');
        }}
        type="button"
      >
        <NavigationIcon name="analysis" />
        <span>Analysis</span>
      </button>
      <button onClick={openGames} type="button">
        <NavigationIcon name="games" />
        <span>Games</span>
      </button>
      <a href="https://www.chess.com/explorer" rel="noopener noreferrer" target="_blank">
        <NavigationIcon name="explore" />
        <span>Explore</span>
      </a>
    </nav>
  );
}
