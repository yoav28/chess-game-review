import { Button } from '@heroui/react';

import { useVariationStore } from '../../stores/useVariationStore';

export default function VariationPanel() {
  const { fen, moves, status, feedback, error, reset } = useVariationStore();

  if (!fen) {
    return <p className="review-variation-hint">Make a move to try an alternative.</p>;
  }

  return (
    <div
      aria-live="polite"
      className="review-variation"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-bold">Alternative line</p>
        <Button onPress={reset} radius="sm" size="sm" variant="flat">Return to game</Button>
      </div>
      <p className="text-small">{moves.map(move => move.san).join(' ')}</p>
      {status === 'analyzing' && <p className="text-small text-foreground-500">Analyzing alternative…</p>}
      {error && <p className="text-small text-danger">{error}</p>}
      {feedback && (
        <>
          <p className="flex justify-between gap-2 text-small">
            <strong>{feedback.label}</strong>
            <span>{feedback.evaluation}</span>
          </p>
          {feedback.bestMove && (
            <p className="text-small text-foreground-500">
              Best move in the previous position:
              {' '}
              {feedback.bestMove}
            </p>
          )}
          {feedback.continuation.length > 0 && (
            <p className="text-small text-foreground-500">
              Best continuation:
              {' '}
              {feedback.continuation.join(' ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
