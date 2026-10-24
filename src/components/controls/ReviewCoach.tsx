import type { ReactNode } from 'react';

export default function ReviewCoach({ message, children }: { message?: string; children?: ReactNode }) {
  return (
    <div className="review-coach">
      <svg aria-hidden="true" className="review-coach-avatar" viewBox="0 0 180 180">
        <image height="180" href={message ? '/coach/hikaru.png' : '/coach/hikaru-review.png'} width="180" />
      </svg>
      <div className="review-coach-bubble">{children ?? <p>{message}</p>}</div>
    </div>
  );
}
