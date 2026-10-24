import { useId } from 'react';

import type { ReactNode } from 'react';

export default function ReviewCoach({ message, children }: { message?: string; children?: ReactNode }) {
  const portraitId = useId();

  return (
    <div className="review-coach">
      <svg aria-hidden="true" className="review-coach-avatar" viewBox="0 0 180 180">
        <defs>
          <clipPath id={portraitId}><path d="M0 0H180V124H154V168H180V180H0Z" /></clipPath>
        </defs>
        <image clipPath={message ? undefined : `url(#${portraitId})`} height="180" href="/coach/hikaru.png" width="180" />
      </svg>
      <div className="review-coach-bubble">{children ?? <p>{message}</p>}</div>
    </div>
  );
}
