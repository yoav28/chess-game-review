import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
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
      <button className="chess-primary-button chess-batch-trigger" onClick={() => setIsOpen(true)} type="button">
        Analyze All My Games
      </button>
      <Modal className="chess-batch-modal" isOpen={isOpen} onClose={close} radius="sm">
        <ModalContent>
          <ModalHeader>Analyze My Games</ModalHeader>
          <ModalBody>
            <p className="chess-batch-description">Keep this tab open while your games are analyzed. Completed reviews are saved in this browser.</p>
            <label className="chess-setting-field">
              <span>Period</span>
              <select disabled={isLoading} onChange={event => setPeriod(event.target.value)} value={period}>
                <option value="day">Last day</option>
                <option value="week">Last week</option>
                <option value="month">Last month</option>
              </select>
            </label>
            <label className="chess-setting-field">
              <span>Game limit</span>
              <select disabled={isLoading} onChange={event => setLimit(event.target.value)} value={limit}>
                <option value="10">10 games</option>
                <option value="100">100 games</option>
                <option value="1000">1000 games</option>
                <option value="all">All games</option>
              </select>
            </label>
            {error && <p className="import-error" role="alert">{error}</p>}
          </ModalBody>
          <ModalFooter>
            <button className="chess-secondary-button" onClick={close} type="button">Cancel</button>
            <button className="chess-primary-button" disabled={isLoading} onClick={analyze} type="button">{isLoading ? 'Finding Games…' : 'Analyze Games'}</button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
