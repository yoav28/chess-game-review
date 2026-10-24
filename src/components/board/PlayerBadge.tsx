import { Icon } from '@iconify/react/dist/iconify.js';
import { Chess } from 'chess.js';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useMemo } from 'react';

import useLoser from '../../hooks/useLoser';
import usePlayerCountry from '../../queries/usePlayerCountry';
import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useVariationStore } from '../../stores/useVariationStore';
import cn from '../../utils/cn';
import { dailyIncrementRegex, mainTimeRegex } from '../../utils/formatTimeControl';
import formatTimestamp from '../../utils/formatTimestamp';
import getCaptured from '../../utils/getCaptured';
import getDiff from '../../utils/getDiff';
import isChessCom from '../../utils/isChessCom';
import useNames from '../../utils/useNames';
import CountryFlag from '../CountryFlag';
import PlayerAvatar from '../PlayerAvatar';
import CapturedGroup from './CapturedGroup';

import type { Capturable } from '../../utils/getCaptured';
import type { Color } from 'chess.js';

dayjs.extend(duration);
dayjs.extend(relativeTime);

export default function PlayerBadge({ color }: {
  color: Color;
}) {
  const currentGame = useBoardStore(state => state.currentGame);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const timestamps = useBoardStore(state => state.timestamps);
  const history = currentGame.history({ verbose: true });
  const header = currentGame.header();
  const variationFen = useVariationStore(state => state.fen);
  const variationMoves = useVariationStore(state => state.moves);
  const displayedGame = new Chess(variationFen ?? (currentMoveNum > 0 ? history[currentMoveNum - 1].after : history[0]?.before ?? currentGame.fen()));
  const board = displayedGame.board();
  const showRatings = useSettingsStore(state => state.settings.showRatings);

  const timeControl = useMemo(() => {
    if (!header.TimeControl)
      return null;
    const mainTimeMatches = header.TimeControl.match(mainTimeRegex);
    if (!mainTimeMatches)
      return null;

    const seconds = Number(mainTimeMatches[0]);
    const inPgnFormat = dayjs.duration(seconds, 's').format('H:mm:ss');

    return inPgnFormat;
  }, [header]);

  const [wName, bName] = useNames();
  const name = color === 'w' ? wName : bName;
  const site = useSelectGameStore(state => state.site);
  const profileSite = header.White || header.Black ? site : undefined;
  const { data: country } = usePlayerCountry(profileSite, name);
  const rating = color === 'w' ? header.WhiteElo : header.BlackElo;
  const title = color === 'w' ? header.WhiteTitle : header.BlackTitle;
  const turn = displayedGame.turn() === 'w' ? 'b' : 'w';
  const { loser, loseBy } = useLoser();
  const game = useSelectGameStore(state => state.game);
  const playedMoves = [...history.slice(0, currentMoveNum), ...variationMoves];
  const captured = getCaptured(playedMoves, playedMoves.length, color);
  const diff = getDiff(board, color);

  const timeLeft = useMemo(() => {
    // 1.a. if chess.com game is correspondant, display fixed increment
    if (game && isChessCom(game) && game.time_class === 'daily') {
      if (Object.entries(header).length === 0) {
        return null;
      }

      if (header.Event === 'vs Computer') {
        // if game vs bot, no time control
        return null;
      }

      const incrementAfterSlash = header.TimeControl.match(dailyIncrementRegex)!;
      const increment = Number(incrementAfterSlash[0]);
      const days = dayjs.duration(increment, 'seconds').days();

      return days > 1 ? `${days} days` : `${days} day`;
    }

    // 1.b. if lichess game is correspondant, display fixed increment
    if (game && !isChessCom(game) && game.speed === 'correspondence') {
      const days = game.daysPerTurn!;

      return days > 1 ? `${days} days` : `${days} day`;
    }

    // 1.c. if game from PGN is correspondant, display fixed increment
    else if (header.TimeControl && header.TimeControl.match(dailyIncrementRegex)) {
      // this would only work if the PGN comes from chess.com
      // other than that, there's no way of determining if it's correspondant
      const incrementAfterSlash = header.TimeControl.match(dailyIncrementRegex)!;
      const increment = Number(incrementAfterSlash[0]);
      const days = dayjs.duration(increment, 'seconds').days();

      return days > 1 ? `${days} days` : `${days} day`;
    }

    // 2. no timestamps in PGN
    else if (!timestamps) {
      return null;
    }

    // 3. display timestamps normally
    else {
      // first move, display time control
      if (currentMoveNum === 0) {
        return timeControl ? formatTimestamp(timeControl) : null;
      }

      // final move
      if (currentMoveNum === history.length) {
        // override with 0:00 if lose by timeout
        if (loser === color && loseBy === 'timeout')
          return '0:00';

        // override with 0:00 if draw by insufficient vs timeout
        if (header.Result === '1/2-1/2'
          && (header.Termination === 'Game drawn by timeout vs insufficient material' /* chess.com */
          || header.Termination === 'Time forfeit' /* lichess */
          )) {
          if (captured.p === 8
            && captured.n === 2
            && captured.b === 2
            && captured.r === 2
            && captured.q === 1
          ) {
            // this side is the one who timeouts
            return '0:00';
          }
        }
      }

      const index = history.slice(0, currentMoveNum).reduce((latest, move, index) => move.color === color ? index : latest, -1);
      const timestamp = index >= 0 ? timestamps[index] : timeControl;

      return timestamp ? formatTimestamp(timestamp) : null;
    }
  }, [currentMoveNum, color, timeControl, header, loser, loseBy, timestamps]);

  return (
    <div className="board-player">
      <div className="board-player-identity">
        <PlayerAvatar className="board-player-avatar" color={color} name={name} site={profileSite} />
        <div className="board-player-details">
          <div className="board-player-name-line">
            {title && <span className="board-player-title">{title}</span>}
            <span className="board-player-name">{name}</span>
            {rating && showRatings && (
              <span className="board-player-rating">
                (
                {rating}
                )
              </span>
            )}
            <CountryFlag country={country || (color === 'w' ? header.WhiteCountry : header.BlackCountry)} />
          </div>
          <div className="board-player-captured">
            {Object.entries(captured).map(([piece, number]) => (
              <CapturedGroup
                color={color === 'w' ? 'b' : 'w'}
                key={piece}
                number={number}
                piece={piece as Capturable}
              />
            ))}
            {diff > 0 && <span className="board-player-material">{`+${diff}`}</span>}
          </div>
        </div>
      </div>
      {timeLeft && (
        <div
          className={cn('board-clock', `
            board-clock-${color}
          `, color !== turn && `board-clock-active`)}
        >
          {color !== turn && <Icon icon="material-symbols:schedule-outline-rounded" />}
          <span>{timeLeft}</span>
        </div>
      )}
    </div>
  );
}
