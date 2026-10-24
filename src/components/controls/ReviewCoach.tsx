import { useId } from 'react';

import type { ReactNode } from 'react';

export default function ReviewCoach({ message, children }: { message?: string; children?: ReactNode }) {
  const portraitId = useId();

  return (
    <div className="review-coach">
      <svg aria-hidden="true" className="review-coach-avatar" viewBox="0 0 80 80">
        <defs>
          <clipPath id={portraitId}><path d="M0 0H80V54H66V67H80V80H0Z" /></clipPath>
        </defs>
        <image clipPath={`url(#${portraitId})`} height="80" href="/coach/default.png" width="80" />
      </svg>
      <div className="review-coach-bubble">{children ?? <p>{message}</p>}</div>
    </div>
  );
}
