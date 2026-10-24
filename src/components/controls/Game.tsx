import Result from '../../icons/result/Result';
import TimeClass from '../../icons/time-class/TimeClass';
import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useStageStore } from '../../stores/useStageStore';
import convertLichessTimeClass from '../../utils/convertLichessTimeClass';
import { formatChessComTimeControl, formatLichessTimeControl } from '../../utils/formatTimeControl';
import getChessComResult from '../../utils/getChessComResult';
import getLichessResult from '../../utils/getLichessResult';
import isChessCom from '../../utils/isChessCom';
import isChessComBotGame from '../../utils/isChessComBotGame';
import isLichessAI from '../../utils/isLichessAI';
import isLichessBotGame from '../../utils/isLichessBotGame';
import CountryFlag from '../CountryFlag';

import type { ChessComGame, LichessAI, LichessGame, LichessPlayer } from '../../queries/useMonthlyArchives';

export default function Game({ game }: { game: ChessComGame | LichessGame }) {
  const loadGame = useBoardStore(state => state.loadGame);
  const username = useSelectGameStore(state => state.username)!;
  const submitGame = useSelectGameStore(state => state.submitGame);
  const showRatings = useSettingsStore(state => state.settings.showRatings);
  const setStage = useStageStore(state => state.setStage);

  function getLichessUsername(player: LichessPlayer | LichessAI) {
    return isLichessAI(player) ? `lichess AI level ${player.aiLevel}` : player.user.id;
  }

  function getLichessRating(player: LichessPlayer | LichessAI) {
    return isLichessAI(player) ? 0 : player.rating;
  }

  const result = isChessCom(game) ? getChessComResult(username, game) : getLichessResult(username, game);

  const timeClass = isChessCom(game)
    ? isChessComBotGame(game)
      ? 'bot'
      : game.time_class
    : isLichessBotGame(game)
      ? 'bot'
      : convertLichessTimeClass(game.speed);

  const timeControl = isChessCom(game)
    ? isChessComBotGame(game)
      ? null
      : formatChessComTimeControl(game.time_control)
    : formatLichessTimeControl(game);

  const wName = isChessCom(game) ? game.white.username : getLichessUsername(game.players.white);
  const bName = isChessCom(game) ? game.black.username : getLichessUsername(game.players.black);
  const wRating = isChessCom(game) ? game.white.rating : getLichessRating(game.players.white);
  const bRating = isChessCom(game) ? game.black.rating : getLichessRating(game.players.black);
  const wCountry = isChessCom(game) ? game.white.country : isLichessAI(game.players.white) ? undefined : game.players.white.user.flag || game.players.white.user.country;
  const bCountry = isChessCom(game) ? game.black.country : isLichessAI(game.players.black) ? undefined : game.players.black.user.flag || game.players.black.user.country;
  const totalMovesRegex = /\d+(?=\.\s)/g;
  const totalMoves = (game.pgn.match(totalMovesRegex) || []).length;

  return (
    <button
      className="game-list-row"
      onClick={() => {
        setStage('loaded');
        loadGame(game.pgn);
        submitGame(game);
      }}
      type="button"
    >
      <span className="game-list-time">
        <TimeClass className="size-5" timeClass={timeClass} />
        <span>{timeControl}</span>
      </span>
      <span className="game-list-players">
        <span className="game-list-player">
          <span>{wName}</span>
          <CountryFlag country={wCountry} />
          {showRatings && (
            <span className="game-list-rating">
              (
              {wRating}
              )
            </span>
          )}
        </span>
        <span className="game-list-player">
          <span>{bName}</span>
          <CountryFlag country={bCountry} />
          {showRatings && (
            <span className="game-list-rating">
              (
              {bRating}
              )
            </span>
          )}
        </span>
      </span>
      <span className="game-list-result">
        <span>{totalMoves}</span>
        <Result className="size-5" result={result} />
      </span>
    </button>
  );
}
