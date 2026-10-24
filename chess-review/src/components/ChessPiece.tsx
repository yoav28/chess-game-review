import type { PieceSymbol } from 'chess.js'
import type { PieceSet } from '../lib/board-appearance'
import { GeometricPiece, LetterPiece } from './AlternatePieces'

export function Piece({ type, color, set = 'classic' }: { type: PieceSymbol; color: 'w' | 'b'; set?: PieceSet }) {
  return (
    <svg className={`chess-piece chess-piece-${color}`} data-piece-set={set} viewBox="0 0 80 80" aria-hidden="true">
      <g strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        {set === 'classic' && <>
        {type === 'p' && <><circle cx="40" cy="24" r="9" /><path d="M32 34h16l-3 9 6 15H29l6-15z" /><path d="M26 59h28l3 9H23z" /></>}
        {type === 'r' && <><path d="M23 15h9v9h8v-9h8v9h8v-9h6v20l-8 7 2 16H28l2-16-7-7z" /><path d="M25 58h32l3 10H22z" /><path d="M30 36h24M30 52h24" /></>}
        {type === 'n' && <><path d="m24 57 5-14 13-11-10 1-9 7-7-7 12-18 13 1 4-7 5 12c12 9 13 24 8 36z" /><path d="m25 57-4 11h41l-4-11z" /><path d="m31 24 3-3m15 9c7 7 7 15 5 21" fill="none" /><circle cx="38" cy="22" r="1.6" className="chess-piece-detail" stroke="none" /></>}
        {type === 'b' && <><circle cx="40" cy="12" r="4" /><path d="M40 17c-8 8-15 15-12 22 2 5 7 6 8 9l-7 10h22l-7-10c1-3 6-4 8-9 3-7-4-14-12-22z" /><path d="m44 24-9 14" fill="none" /><path d="M26 58h28l6 10H20z" /><path d="M32 47h16" fill="none" /></>}
        {type === 'q' && <><path d="m20 26 12 10 8-14 8 14 12-10-8 27H28z" /><circle cx="19" cy="22" r="4" /><circle cx="40" cy="18" r="4" /><circle cx="61" cy="22" r="4" /><path d="M28 53h24l3 7H25zM25 60h30l5 8H20z" /><path d="M29 46h22" fill="none" /></>}
        {type === 'k' && <><path d="M40 9v16m-7-10h14" fill="none" strokeWidth="4" /><path d="M40 30c-12-15-27-3-19 9l10 14h18l10-14c8-12-7-24-19-9z" /><path d="M31 53h18l5 7H26zM26 60h28l5 8H21z" /><path d="M40 31v16" fill="none" /></>}
        </>}
        {set === 'geometric' && <GeometricPiece type={type} />}
        {set === 'letters' && <LetterPiece type={type} />}
      </g>
    </svg>
  )
}
