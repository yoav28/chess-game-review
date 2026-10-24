import { Icon } from '@iconify/react/dist/iconify.js';

import { useReviewStore } from '../../stores/useReviewStore';
import { openReview } from '../../utils/reviewSession';

export default function RecentReviews() {
  const reviews = useReviewStore(state => state.reviews);
  const storageError = useReviewStore(state => state.storageError);
  const remove = useReviewStore(state => state.remove);

  if (!reviews.length && !storageError)
    return null;

  return (
    <section aria-label="Recent reviews" className="recent-reviews">
      {storageError && <p className="import-error recent-review-note" role="status">{storageError}</p>}
      {reviews.length > 0 && <h2>Recent Reviews</h2>}
      {reviews.map(review => (
        <div className="recent-review-row" key={review.id}>
          <button className="recent-review-link" onClick={() => openReview(review)} type="button">
            <span>
              {review.pgn.match(/\[White "([^"]+)"\]/)?.[1] || 'White'}
              {' vs. '}
              {review.pgn.match(/\[Black "([^"]+)"\]/)?.[1] || 'Black'}
            </span>
            <span>
              {new Date(review.savedAt).toLocaleDateString()}
              {' · '}
              {review.analysis ? 'Reviewed' : 'Ready to review'}
            </span>
          </button>
          <button
            aria-label="Remove saved review"
            className="recent-review-remove"
            onClick={() => remove(review.id)}
            type="button"
          >
            <Icon icon="material-symbols:close-rounded" />
          </button>
        </div>
      ))}
      {reviews.length > 0 && <p className="recent-review-note">Saved in this browser. Up to 100 recent games.</p>}
    </section>
  );
}
