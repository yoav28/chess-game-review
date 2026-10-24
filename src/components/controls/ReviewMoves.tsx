import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import MoveClassification from '../../icons/move-classifications/MoveClassification';
import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useVariationStore } from '../../stores/useVariationStore';
import { chooseTextColor } from '../../utils/chooseColorFromClassification';
import cn from '../../utils/cn';
import getMoveRows from '../../utils/getMoveRows';
import useNames from '../../utils/useNames';
import EvalGraph from './EvalGraph';
import PrincipalVariation from './PrincipalVariation';
import ReviewStep from './ReviewStep';
import SanMove from './SanMove';
import VariationPanel from './VariationPanel';

import type { Move } from 'chess.js';

export default function ReviewMoves() {
  const view = useReviewViewStore(state => state.view);
  const variationFen = useVariationStore(state => state.fen);
  const { analysisModel, analysisDepth } = useSettingsStore(state => state.settings);
  const [wName, bName] = useNames();

  const { currentGame, currentMoveNum, isFlipped } = useBoardStore(useShallow(state => ({
    currentGame: state.currentGame,
    currentMoveNum: state.currentMoveNum,
    isFlipped: state.isFlipped,
  })));

  const { best3MovesWithClass, openingNames } = useEvalStore(useShallow(state => ({
    best3MovesWithClass: state.best3MovesWithClass,
    openingNames: state.openingNames,
  })));

  const history = currentGame.history({ verbose: true });
  const fens = [history[0]?.before ?? currentGame.fen(), ...history.map(move => move.after)];
  const alternatives = best3MovesWithClass[currentMoveNum] ?? [];

  return (
    <div
      className={cn('review-moves', view === 'analysis' && `
        review-analysis-mode
      `)}
      id="ReviewMoves"
    >
      {view === 'review'
        ? <ReviewStep />
        : (
            <>
              <div className="review-engine-header">
                <span>
                  <Icon icon="material-symbols:check-circle-rounded" />
                  {' '}
                  Analysis
                </span>
                <span>
                  depth=
                  {analysisDepth}
                  {' '}
                  | Stockfish
                  {' '}
                  {analysisModel === 'nnue' ? 'NNUE' : 'Classical'}
                </span>
              </div>
              <div className="review-feedback">
                {variationFen && <VariationPanel />}
                {!variationFen && alternatives.slice(0, 3).map((move) => {
                  const evaluation = typeof move.eval === 'number' ? `${move.eval >= 0 ? '+' : ''}${(move.eval / 100).toFixed(2)}` : move.eval;

                  return (
                    <details className="review-engine-variation" key={move.pv}>
                      <summary className="review-engine-line">
                        <span className={`
                          review-evaluation
                          ${evaluation.startsWith('-')
? `review-evaluation-black`
: ''}
                        `}
                        >
                          {evaluation}
                        </span>
                        <strong className="review-engine-line-moves"><PrincipalVariation fen={fens[currentMoveNum]} moves={move.line ?? [move.pv]} /></strong>
                        <Icon className="review-engine-line-arrow" icon="material-symbols:arrow-drop-down-rounded" />
                      </summary>
                      <p className="review-engine-continuation"><PrincipalVariation fen={fens[currentMoveNum]} limit={40} moves={move.line ?? [move.pv]} /></p>
                    </details>
                  );
                })}
              </div>
            </>
          )}
      <div className="review-opening">
        <span>{openingNames[currentMoveNum] ?? 'Starting Position'}</span>
        <Icon icon="material-symbols:menu-book-rounded" />
      </div>
      <div className="review-game-heading">
        <strong>
          {wName}
          {' '}
          <span>-</span>
          {' '}
          {bName}
        </strong>
        <span>{currentGame.header().Result}</span>
      </div>
      <div aria-label="Game moves" className="review-move-list" role="list">
        {getMoveRows(history).map(row => (
          <div className="review-move-row" key={row.number} role="listitem">
            <span className="review-move-number">
              {row.number}
              .
            </span>
            {row.white ? <MoveButton move={row.white.move} moveIndex={row.white.index} /> : <span />}
            {row.black ? <MoveButton move={row.black.move} moveIndex={row.black.index} /> : <span />}
          </div>
        ))}
        <p className="review-game-result">{currentGame.header().Result}</p>
      </div>
      {view === 'review' && (
        <>
          <div className="review-analysis-graph"><EvalGraph /></div>
          <div className="review-external-links">
            <a href={`https://www.chess.com/analysis?fen=${encodeURIComponent(variationFen ?? fens[currentMoveNum])}&flip=${isFlipped}`} rel="noreferrer" target="_blank">
              Open on Chess.com
              <Icon icon="material-symbols:open-in-new" />
            </a>
            <a href={`https://lichess.org/analysis/${encodeURIComponent(variationFen ?? fens[currentMoveNum])}`} rel="noreferrer" target="_blank">
              Lichess
              <Icon icon="material-symbols:open-in-new" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function MoveButton({ moveIndex, move }: { moveIndex: number; move: Move }) {
  const ref = useRef<HTMLButtonElement>(null);
  const view = useReviewViewStore(state => state.view);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const toMove = useBoardStore(state => state.toMove);
  const classification = useEvalStore(state => state.classHistory[moveIndex]);
  const realIndex = moveIndex + 1;
  const showClassification = ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder'].includes(classification);

  useEffect(() => {
    if (currentMoveNum === realIndex)
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentMoveNum, realIndex]);

  return (
    <Button
      aria-current={currentMoveNum === realIndex ? 'step' : undefined}
      aria-label={`${move.san}${showClassification ? ` (${classification})` : ''}`}
      className={cn('review-move-button', view === 'review' && chooseTextColor(classification))}
      disableAnimation
      onPress={() => toMove(realIndex)}
      radius="sm"
      ref={ref}
      size="sm"
      variant="light"
    >
      <SanMove color={move.color} san={move.san} />
      {showClassification && <MoveClassification classification={classification} />}
    </Button>
  );
}
