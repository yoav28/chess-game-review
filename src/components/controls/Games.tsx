import { Accordion, AccordionItem, Button, Input, Select, SelectItem } from '@heroui/react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import Result from '../../icons/result/Result';
import TimeClass from '../../icons/time-class/TimeClass';
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
    control,
    formState,
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
    <div className="flex max-h-full flex-col gap-2 overflow-y-scroll" id="Games">
      <BatchAnalysis />
      <p className="text-sm text-foreground-500">
        Recent games for
        {username}
      </p>
      <Accordion
        className="mb-0 rounded-small"
        isCompact
        variant="bordered"
      >
        <AccordionItem
          aria-label="Filter"
          classNames={{
            content: 'pb-3',
            title: 'text-sm',
          }}
          key="filter"
          title="Filter"
        >
          <form
            className="flex flex-col gap-2"
            onSubmit={handleSubmit(onSubmit)}
          >
            <Controller
              control={control}
              name="opponent"
              render={({ field }) => (
                <Input
                  {...field}
                  label="Opponent"
                  size="sm"
                />
              )}
            />
            <div className="flex gap-2">
              <Controller
                control={control}
                name="result"
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Result"
                    selectedKeys={[field.value]}
                    selectionMode="single"
                    size="sm"
                  >
                    {['win', 'lose', 'draw'].map(result => (
                      <SelectItem
                        key={result}
                        startContent={<Result className="size-5" result={result as 'win' | 'lose' | 'draw'} />}
                      >
                        {capitalize(result)}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Color"
                    selectedKeys={[field.value]}
                    selectionMode="single"
                    size="sm"
                  >
                    {['w', 'b'].map(color => (
                      <SelectItem key={color}>{color === 'w' ? 'White' : 'Black'}</SelectItem>
                    ))}
                  </Select>
                )}
              />
              <Controller
                control={control}
                name="timeClass"
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Time Class"
                    selectedKeys={[field.value]}
                    selectionMode="single"
                    size="sm"
                  >
                    {['bullet', 'blitz', 'rapid', 'daily', 'bot'].map(tc => (
                      <SelectItem
                        key={tc}
                        startContent={<TimeClass className="size-5" timeClass={tc as TimeClassType} />}
                      >
                        {capitalize(tc)}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                className="text-shadow-xs"
                color="primary"
                isDisabled={!formState.isValid}
                radius="sm"
                size="sm"
                type="submit"
              >
                Filter
              </Button>
              <Button
                fullWidth={false}
                onPress={() => {
                  reset();
                  setFiltered(games);
                }}
                radius="sm"
                size="sm"
              >
                Reset
              </Button>
            </div>
          </form>
        </AccordionItem>
      </Accordion>
      <div className="min-h-0 overflow-y-scroll">
        {
          filtered
            ? filtered.length > 0
              ? filtered.map(game => <Game game={game} key={isChessCom(game) ? game.uuid : game.id} />)
              : <p className="text-center text-sm">No games found.</p>
            : null
        }
      </div>
    </div>
  );
}
