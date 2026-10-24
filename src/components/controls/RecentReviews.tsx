import { Button } from '@heroui/react';

import { useReviewStore } from '../../stores/useReviewStore';
import { openReview } from '../../utils/reviewSession';

export default function RecentReviews() {
  const reviews = useReviewStore(state => state.reviews);
  const storageError = useReviewStore(state => state.storageError);
  const remove = useReviewStore(state => state.remove);

  return (
    <section aria-label="Recent reviews" className="mt-6 flex flex-col gap-2">
      {storageError && <p className="text-small text-warning" role="status">{storageError}</p>}
      {reviews.length > 0 && <h2 className="text-small font-semibold">Recent reviews</h2>}
      {reviews.map(review => (
        <div
          className="flex items-center gap-2 border-b border-default-200 py-2"
          key={review.id}
        >
          <button
            className={`
              min-w-0 grow text-left text-small
              hover:underline
            `}
            onClick={() => openReview(review)}
            type="button"
          >
            <span className="block truncate">
              {review.pgn.match(/\[White "([^"]+)"\]/)?.[1] || 'White'}
              {' vs. '}
              {review.pgn.match(/\[Black "([^"]+)"\]/)?.[1] || 'Black'}
            </span>
            <span className="text-tiny text-default-500">
              {new Date(review.savedAt).toLocaleDateString()}
              {' · '}
              {review.analysis ? 'Reviewed' : 'Ready to review'}
            </span>
          </button>
          <Button aria-label="Remove saved review" onPress={() => remove(review.id)} size="sm" variant="light">Remove</Button>
        </div>
      ))}
      {reviews.length > 0 && <p className="text-tiny text-default-500">Saved on this browser. Up to 100 recent games are kept as space allows.</p>}
    </section>
  );
}
