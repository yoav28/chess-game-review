import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useShallow } from 'zustand/react/shallow';

import { useBoardStore } from '../../stores/useBoardStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';
import { useVariationStore } from '../../stores/useVariationStore';
import useNames from '../../utils/useNames';
import NavigationIcon from '../NavigationIcon';
import AnalysisTabs from './AnalysisTabs';
import Forms from './Forms';
import GameNav from './GameNav';
import Games from './Games';
import Review from './Review';

import '../../styles/review.css';

export default function Controls() {
  const reset = useBoardStore(state => state.reset);
  const { view, setView } = useReviewViewStore();

  const { stage, setStage, isLoaded, reviewFinished } = useStageStore(useShallow(state => ({
    stage: state.stage,
    setStage: state.setStage,
    isLoaded: state.computed.isLoaded,
    reviewFinished: state.computed.reviewFinished,
  })));

  const { site, resetSelectGameStore } = useSelectGameStore(useShallow(state => ({
    site: state.site,
    resetSelectGameStore: state.reset,
  })));

  const [wName, bName] = useNames();
  const isAnalysis = stage === 'review-moves' && view === 'analysis';

  function back() {
    if (stage === 'select-month' || stage === 'select-game') {
      resetSelectGameStore();
      setStage('home');
    }
    else if (stage === 'review-moves') {
      useVariationStore.getState().reset();
      if (isAnalysis)
        setView('review');
      else
        setStage('review-overview');
    }
    else {
      reset();

      if (site) {
        setStage('select-game');
      }
      else {
        resetSelectGameStore();
        setStage('home');
      }
    }
  }

  return (
    <section className="review-panel" id="Controls">
      <Helmet>
        <title>{isLoaded ? `${wName} vs. ${bName} | Game Review` : 'Game Review'}</title>
      </Helmet>
      <header className="review-panel-header">
        <Button
          aria-label="Back"
          className={`
            review-back
            ${stage === 'home' ? 'invisible' : ''}
          `}
          isIconOnly
          onPress={back}
          radius="sm"
          size="sm"
          variant="light"
        >
          <Icon icon="material-symbols:chevron-left-rounded" />
        </Button>
        <h1>
          {isAnalysis ? <NavigationIcon name="analysis" /> : <img alt="" src="/star.svg" />}
          {stage === 'select-month' || stage === 'select-game' ? 'Recent Games' : isAnalysis ? 'Analysis' : 'Game Review'}
        </h1>
        {reviewFinished && (
          <Button
            aria-label={isAnalysis ? 'Game Review' : 'Analysis'}
            className="review-header-analysis"
            isIconOnly
            onPress={() => {
              useVariationStore.getState().reset();
              setView(isAnalysis ? 'review' : 'analysis');
              setStage('review-moves');
            }}
            radius="sm"
            size="sm"
            variant="light"
          >
            {isAnalysis ? <Icon icon="material-symbols:stars-rounded" /> : <NavigationIcon name="analysis" />}
          </Button>
        )}
      </header>
      {isAnalysis && <AnalysisTabs />}
      <div className={`
        review-panel-content
        ${stage === 'review-moves'
? `review-panel-content-moves`
: ''}
      `}
      >
        {stage === 'home'
          ? <Forms />
          : stage === 'select-month' || stage === 'select-game'
            ? <Games />
            : <Review />}
      </div>
      {stage === 'review-moves' && <GameNav />}
    </section>
  );
}
