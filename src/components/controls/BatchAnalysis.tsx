import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';

import { fetchUserGames } from '../../queries/fetchUserGames';
import { useBatchStore } from '../../stores/useBatchStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';

export default function BatchAnalysis() {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState('week');
  const [limit, setLimit] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef<AbortController>();
  const username = useSelectGameStore(state => state.username)!;
  const site = useSelectGameStore(state => state.site)!;

  useEffect(() => () => request.current?.abort(), []);

  function close() {
    request.current?.abort();
    setIsOpen(false);
    setIsLoading(false);
  }

  async function analyze() {
    const controller = new AbortController();
    request.current = controller;
    setError(undefined);
    setIsLoading(true);

    try {
      const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;

      const games = await fetchUserGames(username, site, {
        since: Date.now() - days * 24 * 60 * 60 * 1000,
        limit: limit === 'all' ? Number.POSITIVE_INFINITY : Number(limit),
        signal: controller.signal,
      });

      if (controller.signal.aborted)
        return;

      if (!games.length) {
        setError('No games found in this period.');

        return;
      }

      useBoardStore.getState().loadGame(games[0].pgn);
      useSelectGameStore.getState().submitGame(games[0]);
      useBatchStore.getState().start(games.map(game => ({ pgn: game.pgn, game, username, site })));
      useStageStore.getState().setStage('loaded');
      setIsOpen(false);
    }
    catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Could not fetch games. Please try again.');
    }
    finally {
      if (!controller.signal.aborted)
        setIsLoading(false);
    }
  }

  return (
    <>
      <Button color="primary" onPress={() => setIsOpen(true)} radius="sm" variant="flat">
        Analyze all my games
      </Button>
      <Modal isOpen={isOpen} onClose={close} radius="sm">
        <ModalContent>
          <ModalHeader>Analyze my games</ModalHeader>
          <ModalBody>
            <p className="text-sm text-foreground-500">Games are analyzed one at a time. Keep this tab open; completed reviews are saved in this browser.</p>
            <Select
              disallowEmptySelection
              isDisabled={isLoading}
              label="Period"
              onSelectionChange={keys => setPeriod(String(Array.from(keys)[0]))}
              selectedKeys={[period]}
            >
              <SelectItem key="day">Last day</SelectItem>
              <SelectItem key="week">Last week</SelectItem>
              <SelectItem key="month">Last month</SelectItem>
            </Select>
            <Select
              disallowEmptySelection
              isDisabled={isLoading}
              label="Game limit"
              onSelectionChange={keys => setLimit(String(Array.from(keys)[0]))}
              selectedKeys={[limit]}
            >
              <SelectItem key="10">10 games</SelectItem>
              <SelectItem key="100">100 games</SelectItem>
              <SelectItem key="1000">1000 games</SelectItem>
              <SelectItem key="all">All games</SelectItem>
            </Select>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          </ModalBody>
          <ModalFooter>
            <Button onPress={close} radius="sm" variant="light">Cancel</Button>
            <Button color="primary" isLoading={isLoading} onPress={analyze} radius="sm">Analyze games</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
