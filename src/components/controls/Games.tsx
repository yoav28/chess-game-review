import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import useRecentGames from '../../queries/useRecentGames';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import capitalize from '../../utils/capitalize';
import convertLichessTimeClass from '../../utils/convertLichessTimeClass';
import getChessComResult from '../../utils/getChessComResult';
import getLichessResult from '../../utils/getLichessResult';
import isChessCom from '../../utils/isChessCom';
import isChessComBotGame from '../../utils/isChessComBotGame';
import isLichessAI from '../../utils/isLichessAI';
import isLichessBotGame from '../../utils/isLichessBotGame';
import Loading from '../Loading';
import BatchAnalysis from './BatchAnalysis';
import Game from './Game';

import type { TimeClassType } from '../../icons/time-class/TimeClass';
import type { Color } from 'chess.js';
import type { SubmitHandler } from 'react-hook-form';

interface Inputs {
  opponent: string;
  result: 'win' | 'lose' | 'draw';
  color: Color;
  timeClass: TimeClassType;
}

export default function Games() {
  const username = useSelectGameStore(state => state.username)!;
  const { data: games, isLoading, error } = useRecentGames();
  const [filtered, setFiltered] = useState(games);

  useEffect(() => {
    setFiltered(games);
  }, [games]);

  const {
    handleSubmit,
    register,
    reset,
  } = useForm<Inputs>({ defaultValues: {
    opponent: '',
    result: undefined,
    color: undefined,
    timeClass: undefined,
  } });

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    setFiltered(games?.filter((game) => {
      const white = isChessCom(game) ? game.white.username : isLichessAI(game.players.white) ? '' : game.players.white.user.name;
      const black = isChessCom(game) ? game.black.username : isLichessAI(game.players.black) ? '' : game.players.black.user.name;
      const isWhite = white.toLowerCase() === username.toLowerCase();
      const opponent = isWhite ? black : white;
      const result = isChessCom(game) ? getChessComResult(username, game) : getLichessResult(username, game);
      const isBot = isChessCom(game) ? isChessComBotGame(game) : isLichessBotGame(game);
      const timeClass = isChessCom(game) ? game.time_class : convertLichessTimeClass(game.speed);

      return opponent.toLowerCase().includes(data.opponent.toLowerCase())
        && (!data.result || result === data.result)
        && (!data.color || (data.color === 'w' ? isWhite : !isWhite))
        && (!data.timeClass || (data.timeClass === 'bot' ? isBot : timeClass === data.timeClass));
    }));
  };

  if (isLoading)
    return <Loading label="Fetching games…" />;

  if (error)
    return <p className="text-sm text-danger" role="alert">{error.message}</p>;

  return (
    <div className="games-browser" id="Games">
      <div className="games-browser-top">
        <BatchAnalysis />
        <p className="games-browser-heading">
          Recent games for
          <strong>{username}</strong>
        </p>
      </div>
      <details className="games-filter">
        <summary>Filter games</summary>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="chess-setting-field">
            <span>Opponent</span>
            <input className="import-input" placeholder="Opponent username" {...register('opponent')} />
          </label>
          <div className="games-filter-selects">
            <label className="chess-setting-field">
              <span>Result</span>
              <select {...register('result')}>
                <option value="">All results</option>
                {['win', 'lose', 'draw'].map(result => <option key={result} value={result}>{capitalize(result)}</option>)}
              </select>
            </label>
            <label className="chess-setting-field">
              <span>Color</span>
              <select {...register('color')}>
                <option value="">Both colors</option>
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
            </label>
            <label className="chess-setting-field">
              <span>Time class</span>
              <select {...register('timeClass')}>
                <option value="">All types</option>
                {['bullet', 'blitz', 'rapid', 'daily', 'bot'].map(tc => <option key={tc} value={tc}>{capitalize(tc)}</option>)}
              </select>
            </label>
          </div>
          <div className="games-filter-actions">
            <button
              className="chess-secondary-button"
              onClick={() => {
                reset();
                setFiltered(games);
              }}
              type="button"
            >
              Reset
            </button>
            <button className="chess-secondary-button" type="submit">Filter</button>
          </div>
        </form>
      </details>
      <div className="games-list">
        {filtered?.length
          ? filtered.map(game => <Game game={game} key={isChessCom(game) ? game.uuid : game.id} />)
          : <p className="recent-review-note">No games found.</p>}
      </div>
    </div>
  );
}
