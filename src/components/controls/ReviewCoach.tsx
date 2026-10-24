import type { ReactNode } from 'react';

export default function ReviewCoach({ message, children }: { message?: string; children?: ReactNode }) {
  return (
    <div className="review-coach">
      <svg aria-hidden="true" className="review-coach-avatar" viewBox="0 0 68 76">
        <path d="M4 76c0-14 9-23 22-26h16c13 3 22 12 22 26" fill="#787e9a" />
        <path d="m25 47 9 15 9-15-4-10H29Z" fill="#dbaa88" />
        <path d="m24 50 10 12-8 9-9-18m26-3-9 12 8 9 9-18" fill="#a5aac2" />
        <path d="M17 27c0-15 8-22 18-22 13 0 19 10 17 23l-3 13c-3 10-10 15-15 15s-12-5-15-15Z" fill="#e9bc97" />
        <path d="M17 30C10 10 25 0 38 3c15 1 19 13 13 29l-5-17-8 4-12-4-5 16Z" fill="#50392e" />
        <path d="m24 29 6-1m9 0 6 1" stroke="#50392e" strokeLinecap="round" strokeWidth="2" />
        <path d="m29 43 6 2 6-2" fill="none" stroke="#9c654b" strokeLinecap="round" strokeWidth="1.8" />
        <path d="m34 31-2 7h4" fill="none" stroke="#cc9875" strokeLinecap="round" />
        <circle cx="27" cy="32" fill="#3c3630" r="1.4" />
        <circle cx="42" cy="32" fill="#3c3630" r="1.4" />
      </svg>
      <div className="review-coach-bubble">{children ?? <p>{message}</p>}</div>
    </div>
  );
}
