import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useEffect, useState } from 'react';

import MoveClassification from '../../icons/move-classifications/MoveClassification';
import { useBoardStore } from '../../stores/useBoardStore';
import { formatCp, useEvalStore } from '../../stores/useEvalStore';
import { useStageStore } from '../../stores/useStageStore';
import { useVariationStore } from '../../stores/useVariationStore';
import lanToSan from '../../utils/lanToSan';
import ReviewCoach from './ReviewCoach';
import SanMove from './SanMove';
import VariationPanel from './VariationPanel';

import '../../styles/review-step.css';

export default function ReviewStep() {
  const { currentGame, currentMoveNum, toMove } = useBoardStore();
  const { classHistory, cps, openingNames, best3MovesWithClass } = useEvalStore();
  const variationFen = useVariationStore(state => state.fen);
  const [retryTarget, setRetryTarget] = useState<number | null>(null);
  const history = currentGame.history({ verbose: true });
  const moveNumber = retryTarget ?? currentMoveNum;
  const move = history[moveNumber - 1];
  const classification = classHistory[moveNumber - 1];
  const badMove = ['inaccuracy', 'mistake', 'blunder'].includes(classification);
  const opening = openingNames[moveNumber];
  const score = cps[moveNumber] ?? 0;
  const evaluation = typeof score === 'number' ? `${score > 0 ? '+' : ''}${(score / 100).toFixed(2)}` : formatCp(score);
  const best = best3MovesWithClass[moveNumber - 1]?.[0];
  const fens = [history[0]?.before ?? currentGame.fen(), ...history.map(move => move.after)];
  const preferred = best ? lanToSan(best.pv, moveNumber - 1, fens) : null;
  const title = !move ? 'Starting Position' : `${move.san} is ${classification === 'book' ? 'a book move' : classification === 'best' ? 'the best move' : classification === 'great' ? 'a great move' : classification === 'inaccuracy' ? 'an inaccuracy' : ['blunder', 'mistake'].includes(classification) ? `a ${classification}` : classification}`;

  const message = retryTarget !== null
    ? `Try a different move instead of ${move.san}. Move a piece on the board to see the engine’s feedback.`
    : !move
        ? 'Choose Next to review the first move, or move a piece to explore the position.'
        : classification === 'book'
          ? opening && !['Starting Position', 'Custom Position'].includes(opening) ? `This move follows ${opening}.` : 'This move is part of a known opening.'
          : classification === 'best'
            ? 'This is the engine’s top choice in this position.'
            : classification === 'brilliant'
              ? 'The engine approves this sacrifice as its best move.'
              : classification === 'great'
                ? 'This is the best move, and the other moves lose a significant amount of advantage.'
                : badMove && preferred
                  ? `The engine preferred ${preferred} in this position. Try finding an alternative on the board.`
                  : `The engine rates this as ${classification === 'excellent' ? 'an excellent' : `a ${classification}`} move.`;

  useEffect(() => {
    if (retryTarget !== null && currentMoveNum !== retryTarget - 1)
      setRetryTarget(null);
  }, [currentMoveNum, retryTarget]);

  return (
    <div className="review-step">
      <ReviewCoach>
        {variationFen
          ? <VariationPanel />
          : (
              <>
                <div className="review-step-title">
                  {move && <MoveClassification classification={classification} />}
                  <strong>
                    {move
                      ? (
                          <>
                            <SanMove color="b" san={move.san} />
                            {title.slice(move.san.length)}
                          </>
                        )
                      : title}
                  </strong>
                  <span className={`
                    review-evaluation
                    ${evaluation.startsWith('-')
? `review-evaluation-black`
: ''}
                  `}
                  >
                    {evaluation}
                  </span>
                </div>
                <p className={classification === 'book' && retryTarget === null
                  ? `sr-only`
                  : `review-step-explanation`}
                >
                  {message}
                </p>
              </>
            )}
      </ReviewCoach>
      <div className="review-step-actions">
        {badMove && retryTarget === null && !variationFen && (
          <Button
            className="review-step-retry"
            onPress={() => {
              useVariationStore.getState().reset();
              setRetryTarget(currentMoveNum);
              toMove(currentMoveNum - 1);
            }}
            radius="sm"
            variant="flat"
          >
            <Icon icon="material-symbols:replay-rounded" />
            Retry
          </Button>
        )}
        <Button
          className="review-primary-button review-step-next"
          color="primary"
          onPress={() => {
            useVariationStore.getState().reset();
            setRetryTarget(null);

            if (moveNumber >= history.length) {
              useStageStore.getState().setStage('review-overview');
            }
            else {
              toMove(moveNumber + 1);
            }
          }}
          radius="sm"
        >
          <Icon icon="material-symbols:arrow-forward-rounded" />
          {moveNumber >= history.length ? 'Finish Review' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
