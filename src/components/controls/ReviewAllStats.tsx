import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useMemo, useState } from 'react';

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

  const totals = useMemo(() => {
    const history = game.history({ verbose: true });
    const totals: Record<string, [number, number]> = {};

    for (let index = 0; index < classHistory.length; index++) {
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
                  <th scope="row">Accuracy</th>
                  <td>{accuracy[0]}</td>
                  <td>{accuracy[1]}</td>
                </tr>
                {['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'forced'].map(classification => (
                  <tr key={classification}>
                    <th scope="row">{capitalize(classification)}</th>
                    <td>{totals[classification]?.[0] ?? 0}</td>
                    <td>{totals[classification]?.[1] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
