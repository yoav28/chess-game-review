import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Chess } from 'chess.js';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import MoveClassification from '../../icons/move-classifications/MoveClassification';
import { useBoardStore } from '../../stores/useBoardStore';
import { formatCp, useEvalStore } from '../../stores/useEvalStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useVariationStore } from '../../stores/useVariationStore';
import { chooseTextColor } from '../../utils/chooseColorFromClassification';
import cn from '../../utils/cn';
import getMoveRows from '../../utils/getMoveRows';
import useNames from '../../utils/useNames';
import EvalGraph from './EvalGraph';
import ReviewStep from './ReviewStep';
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

  const { best3MovesWithClass, cps, classHistory, openingNames } = useEvalStore(useShallow(state => ({
    best3MovesWithClass: state.best3MovesWithClass,
    cps: state.cps,
    classHistory: state.classHistory,
    openingNames: state.openingNames,
  })));

  const history = currentGame.history({ verbose: true });
  const fens = [history[0]?.before ?? currentGame.fen(), ...history.map(move => move.after)];
  const currentMove = history[currentMoveNum - 1];
  const classification = classHistory[currentMoveNum - 1];
  const adv = formatCp(cps[currentMoveNum] ?? 0);
  const alternatives = best3MovesWithClass[currentMoveNum] ?? [];

  return (
    <div className="review-moves" id="ReviewMoves">
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
                <VariationPanel />
                {!variationFen && currentMove && (
                  <div className="review-move-feedback">
                    <MoveClassification classification={classification} />
                    <span>
                      <strong>{currentMove.san}</strong>
                      {' '}
                      is
                      {' '}
                      {classification === 'book' ? 'a book move' : ['mistake', 'blunder'].includes(classification) ? `a ${classification}` : classification === 'great' ? 'a great move' : classification === 'inaccuracy' ? 'an inaccuracy' : classification === 'best' ? 'the best move' : classification}
                    </span>
                    <span className={`
                      review-evaluation
                      ${adv.startsWith('-')
? `review-evaluation-black`
: ''}
                    `}
                    >
                      {adv}
                    </span>
                  </div>
                )}
                {!variationFen && alternatives.slice(0, 3).map((move) => {
                  const line = formatLine(fens[currentMoveNum], move.line ?? [move.pv]);
                  const evaluation = formatCp(move.eval);

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
                        <strong className="review-engine-line-moves">{line}</strong>
                        <Icon className="review-engine-line-arrow" icon="material-symbols:arrow-drop-down-rounded" />
                      </summary>
                      <p className="review-engine-continuation">{formatLine(fens[currentMoveNum], move.line ?? [move.pv], 40)}</p>
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
    </div>
  );
}

function MoveButton({ moveIndex, move }: { moveIndex: number; move: Move }) {
  const ref = useRef<HTMLButtonElement>(null);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const toMove = useBoardStore(state => state.toMove);
  const classification = useEvalStore(state => state.classHistory[moveIndex]);
  const realIndex = moveIndex + 1;

  useEffect(() => {
    if (currentMoveNum === realIndex)
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentMoveNum, realIndex]);

  return (
    <Button
      aria-current={currentMoveNum === realIndex ? 'step' : undefined}
      className={cn('review-move-button', chooseTextColor(classification))}
      disableAnimation
      onPress={() => toMove(realIndex)}
      radius="sm"
      ref={ref}
      size="sm"
      variant="light"
    >
      {move.san}
      {['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder'].includes(classification) && <MoveClassification classification={classification} />}
    </Button>
  );
}

function formatLine(fen: string, moves: string[], limit = 12) {
  const game = new Chess(fen);
  const line: string[] = [];

  for (const lan of moves.slice(0, limit)) {
    try {
      const move = game.move(lan);
      if (move.color === 'w')
        line.push(`${game.moveNumber() - (game.turn() === 'w' ? 1 : 0)}.`);
      line.push(move.san);
    }
    catch {
      break;
    }
  }

  return line.join(' ');
}
