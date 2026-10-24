import { Icon } from '@iconify/react/dist/iconify.js';
import { useShallow } from 'zustand/react/shallow';

import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useVariationStore } from '../../stores/useVariationStore';
import useNames from '../../utils/useNames';
import EvalGraph from './EvalGraph';
import PrincipalVariation from './PrincipalVariation';
import ReviewMoveList from './ReviewMoveList';
import ReviewStep from './ReviewStep';
import VariationPanel from './VariationPanel';

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
      className="review-moves"
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
      <ReviewMoveList />
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
