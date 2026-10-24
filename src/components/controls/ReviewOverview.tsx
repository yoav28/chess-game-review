import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useMemo, useState } from 'react';

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
  const primaryClasses = ['brilliant', 'great', 'best', 'inaccuracy', 'mistake', 'blunder'];

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
            <span
              aria-hidden="true"
              className={`
                review-player-avatar
                review-player-avatar-${index}
              `}
            >
              <svg fill="currentColor" viewBox="0 0 40 40"><path d="M20 5c-4.2 0-7.4 3.2-7.4 7.5 0 3.3 1.4 5.5 3.4 7.5v4c-1.6 1.8-6.6 3.3-9.3 5.2-1.1.8-1.7 2-1.7 3.3V36h30v-3.5c0-1.3-.6-2.5-1.7-3.3-2.7-1.9-7.7-3.4-9.3-5.2v-4c2-2 3.4-4.2 3.4-7.5C27.4 8.2 24.2 5 20 5Z" /></svg>
            </span>
          </div>
        ))}
        <span className="review-comparison-label review-accuracy-label">Accuracy</span>
        <strong className="review-accuracy review-accuracy-white">{accuracy[0]}</strong>
        <strong className="review-accuracy review-accuracy-black">{accuracy[1]}</strong>
      </div>
      <div className="review-classifications">
        {Object.entries(record).filter(([classification]) => expanded || primaryClasses.includes(classification)).map(([classification, counts]) => {
          const cl = classification as Classification;

          return (
            <div className="review-classification-row" key={cl}>
              <span className="review-classification-label">{capitalize(cl)}</span>
              <span className={cn('review-classification-count', chooseTextColor(cl))}>{counts[0]}</span>
              <MoveClassification classification={cl} />
              <span className={cn('review-classification-count', chooseTextColor(cl))}>{counts[1]}</span>
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
