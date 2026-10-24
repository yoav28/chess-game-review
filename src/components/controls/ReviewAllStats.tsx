import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useMemo, useState } from 'react';

import useAdvancedStats from '../../hooks/useAdvancedStats';
import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import capitalize from '../../utils/capitalize';
import useNames from '../../utils/useNames';

import '../../styles/review-all-stats.css';

export default function ReviewAllStats() {
  const [isOpen, setIsOpen] = useState(false);
  const [white, black] = useNames();
  const game = useBoardStore(state => state.currentGame);
  const { accuracy, classHistory } = useEvalStore();
  const stats = useAdvancedStats();

  const totals = useMemo(() => {
    const history = game.history({ verbose: true });
    const totals: Record<string, [number, number]> = {};

    for (let index = 0; index < Math.min(classHistory.length, history.length); index++) {
      const classification = classHistory[index];
      totals[classification] ??= [0, 0];
      totals[classification][history[index]?.color === 'w' ? 0 : 1]++;
    }

    return totals;
  }, [game, classHistory]);

  return (
    <>
      <button className="review-view-all-stats" onClick={() => setIsOpen(true)} type="button">
        <Icon icon="material-symbols:bar-chart-rounded" />
        View All Stats
      </button>
      <Modal classNames={{ base: 'review-all-stats-dialog' }} disableAnimation isOpen={isOpen} onOpenChange={setIsOpen} scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Game Stats</ModalHeader>
          <ModalBody>
            <table className="review-all-stats-table">
              <thead>
                <tr>
                  <th scope="col">Statistic</th>
                  <th scope="col">{white}</th>
                  <th scope="col">{black}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Game Rating</th>
                  {stats.map((player, index) => (
                    <td key={index}>
                      {player.ratingSource === 'estimate' && '≈'}
                      {player.rating ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Accuracy</th>
                  <td>{accuracy[0]}</td>
                  <td>{accuracy[1]}</td>
                </tr>
                {(['Opening', 'Tactics', 'Strategy'] as const).map(phase => (
                  <tr key={phase}>
                    <th scope="row">{phase}</th>
                    {stats.map((player, index) => {
                      const { accuracy, moveCount, averageLoss } = player.phases[phase];

                      return (
                        <td key={index}>
                          {accuracy === null ? '—' : `${accuracy.toFixed(1)}%`}
                          <span className="review-stat-detail">
                            {moveCount}
                            {' '}
                            {moveCount === 1 ? 'move' : 'moves'}
                            {averageLoss !== null && (
                              <span>
                                {averageLoss.toFixed(1)}
                                % avg. win-chance loss
                              </span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'forced'].map(classification => (
                  <tr key={classification}>
                    <th scope="row">{capitalize(classification)}</th>
                    <td>{totals[classification]?.[0] ?? 0}</td>
                    <td>{totals[classification]?.[1] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="review-stats-method" open>
              <summary>How these are calculated</summary>
              <p>Phase accuracy measures how much each move preserves the engine’s winning chances. Forced moves are excluded. Empty categories show a dash.</p>
              <p>Opening covers the first ten full moves from the standard starting position. Tactics includes captures, checks, promotions, and great or brilliant moves. Strategy covers quiet moves after the opening. A move can count toward both Opening and Tactics.</p>
              <p>Ratings marked ≈ are experimental performance estimates. The imported player rating is adjusted by 20 points for each decision-accuracy percentage point above or below 75%, rounded to the nearest 50, and limited to 100–3200. Explicit performance ratings supplied in the PGN are shown directly.</p>
            </details>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
