import { useEffect, useMemo, useRef } from 'react';

import MoveClassification from '../../icons/move-classifications/MoveClassification';
import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import { chooseTextColor } from '../../utils/chooseColorFromClassification';
import cn from '../../utils/cn';
import getMoveRows from '../../utils/getMoveRows';
import getMoveTimes from '../../utils/getMoveTimes';
import SanMove from './SanMove';

import type { Move } from 'chess.js';

import '../../styles/review-move-list.css';

export default function ReviewMoveList() {
  const game = useBoardStore(state => state.currentGame);
  const times = useMemo(() => getMoveTimes(game), [game]);
  const hasTimes = times.some(time => time !== null);

  return (
    <div aria-label="Game moves" className="review-move-list" role="list">
      {getMoveRows(game.history({ verbose: true })).map(row => (
        <div className="review-move-row" data-has-times={hasTimes || undefined} key={row.number} role="listitem">
          <span className="review-move-number">
            {row.number}
            .
          </span>
          {row.white ? <MoveButton move={row.white.move} moveIndex={row.white.index} /> : <span />}
          {row.black ? <MoveButton move={row.black.move} moveIndex={row.black.index} /> : <span />}
          {hasTimes && (
            <div className="review-move-times">
              <MoveTime color="white" seconds={row.white ? times[row.white.index] : null} />
              <MoveTime color="black" seconds={row.black ? times[row.black.index] : null} />
            </div>
          )}
        </div>
      ))}
      <p className="review-game-result">{game.header().Result}</p>
    </div>
  );
}

function MoveButton({ moveIndex, move }: { moveIndex: number; move: Move }) {
  const ref = useRef<HTMLButtonElement>(null);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const toMove = useBoardStore(state => state.toMove);
  const classification = useEvalStore(state => state.classHistory[moveIndex]);
  const selected = currentMoveNum === moveIndex + 1;
  const showClassification = ['brilliant', 'great', 'book', 'best', 'inaccuracy', 'mistake', 'blunder'].includes(classification);

  useEffect(() => {
    if (selected)
      ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <button
      aria-current={selected ? 'step' : undefined}
      aria-label={`${move.san}${showClassification ? ` (${classification})` : ''}`}
      className={cn('review-move-button', showClassification && chooseTextColor(classification))}
      data-classification={showClassification ? classification : undefined}
      onClick={() => toMove(moveIndex + 1)}
      ref={ref}
      type="button"
    >
      <span className="review-move-badge">{showClassification && <MoveClassification classification={classification} />}</span>
      <SanMove color={move.color} san={move.san} />
    </button>
  );
}

function MoveTime({ color, seconds }: { color: 'white' | 'black'; seconds: number | null }) {
  return (
    <span
      aria-label={seconds === null ? undefined : `${color === 'white' ? 'White' : 'Black'} spent ${seconds.toFixed(1)} seconds`}
      className="review-move-time"
      data-color={color}
    >
      {seconds !== null && (
        <>
          <span aria-hidden="true" className="review-move-time-bar" style={{ width: `${Math.min(32, Math.max(2, seconds))}px` }} />
          <span aria-hidden="true" className="review-move-time-value">
            {seconds.toFixed(1)}
            s
          </span>
        </>
      )}
    </span>
  );
}
