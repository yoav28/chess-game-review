import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useMemo, useState } from 'react';

import Miss from '../../icons/move-classifications/Miss';
import MoveClassification from '../../icons/move-classifications/MoveClassification';
import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useStageStore } from '../../stores/useStageStore';
import capitalize from '../../utils/capitalize';
import { chooseTextColor } from '../../utils/chooseColorFromClassification';
import cn from '../../utils/cn';
import useNames from '../../utils/useNames';
import EvalGraph from './EvalGraph';
import ReviewCoach from './ReviewCoach';
import ReviewPhaseSummary from './ReviewPhaseSummary';

import type { Classification } from '../../utils/classify';

export default function ReviewOverview() {
  const [wName, bName] = useNames();
  const [expanded, setExpanded] = useState(false);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const toNextMove = useBoardStore(state => state.toNextMove);
  const accuracy = useEvalStore(state => state.accuracy);
  const classHistory = useEvalStore(state => state.classHistory);
  const currentGame = useBoardStore(state => state.currentGame);
  const setStage = useStageStore(state => state.setStage);
  const header = currentGame.header();

  const record = useMemo(() => {
    const history = currentGame.history({ verbose: true });

    const record: Record<Exclude<Classification, 'forced'>, [number, number]> = {
      brilliant: [0, 0],
      great: [0, 0],
      best: [0, 0],
      excellent: [0, 0],
      good: [0, 0],
      book: [0, 0],
      inaccuracy: [0, 0],
      mistake: [0, 0],
      blunder: [0, 0],
    };

    for (let i = 0; i < classHistory.length; i++) {
      const classification = classHistory[i];
      if (classification !== 'forced')
        record[classification][history[i]?.color === 'w' ? 0 : 1]++;
    }

    return record;
  }, [classHistory, currentGame]);

  const tacticalSide = record.brilliant[0] + record.great[0] >= record.brilliant[1] + record.great[1] ? 0 : 1;
  const tacticalFinds = record.brilliant[tacticalSide] + record.great[tacticalSide];
  const errors = record.mistake[0] + record.mistake[1] + record.blunder[0] + record.blunder[1];
  const summary = tacticalFinds > 0 ? `${tacticalSide === 0 ? 'White' : 'Black'} found ${tacticalFinds === 1 ? 'a great tactical move' : `${tacticalFinds} great tactical moves`} this game.` : errors > 0 ? 'There are some key moments to learn from in this game.' : 'A well-played game! Let’s take a closer look.';
  const visibleClasses: (Classification | 'miss')[] = ['brilliant', 'great', 'best', 'mistake', 'miss', 'blunder'];
  if (expanded)
    visibleClasses.push('excellent', 'good', 'book', 'inaccuracy');

  return (
    <div className="review-overview" id="ReviewOverview">
      <ReviewCoach message={summary} />
      <div className="review-overview-graph"><EvalGraph /></div>
      <div className="review-player-comparison" id="accuracy">
        <span className="review-comparison-label">Players</span>
        {[wName, bName].map((name, index) => (
          <div
            className={`
              review-player-score
              review-player-score-${index}
            `}
            key={index}
          >
            <p className="review-player-name">{name}</p>
            <img
              alt=""
              className="review-player-avatar"
              data-winner={(index === 0 && header.Result === '1-0') || (index === 1 && header.Result === '0-1') || undefined}
              height={48}
              src={`/players/${index === 0 ? 'white' : 'black'}.png`}
              width={48}
            />
          </div>
        ))}
        <span className="review-comparison-label review-accuracy-label">Accuracy</span>
        <strong className="review-accuracy review-accuracy-white">{accuracy[0]}</strong>
        <strong className="review-accuracy review-accuracy-black">{accuracy[1]}</strong>
      </div>
      <div className="review-classifications">
        {visibleClasses.map((classification) => {
          const counts = classification === 'miss' ? ['—', '—'] : record[classification as Exclude<Classification, 'forced'>];
          const countColor = classification === 'miss' ? 'review-classification-miss' : chooseTextColor(classification);

          return (
            <div className="review-classification-row" key={classification} title={classification === 'miss' ? 'Miss classification is not available from this engine.' : undefined}>
              <span className="review-classification-label">{capitalize(classification)}</span>
              <span className={cn('review-classification-count', countColor)}>{counts[0]}</span>
              {classification === 'miss' ? <Miss /> : <MoveClassification classification={classification} />}
              <span className={cn('review-classification-count', countColor)}>{counts[1]}</span>
            </div>
          );
        })}
        <button
          aria-expanded={expanded}
          aria-label={expanded ? 'Show fewer classifications' : 'Show all classifications'}
          className="review-classifications-expand"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          <Icon icon={expanded ? 'material-symbols:keyboard-arrow-up-rounded' : 'material-symbols:keyboard-arrow-down-rounded'} />
        </button>
      </div>
      <ReviewPhaseSummary header={header} />
      <Button
        className="review-primary-button"
        color="primary"
        fullWidth
        onPress={() => {
          useReviewViewStore.getState().setView('review');
          setStage('review-moves');
          if (currentMoveNum === 0)
            toNextMove();
        }}
        radius="sm"
      >
        Start Review
      </Button>
    </div>
  );
}
