import type { PieceSymbol } from 'chess.js'

export function GeometricPiece({ type }: { type: PieceSymbol }) {
  return <>
    {type === 'p' && <><circle cx="40" cy="22" r="10" /><path d="m35 33-9 24h28l-9-24zM23 59h34v9H23z" /></>}
    {type === 'r' && <><path d="M22 14h10v9h6v-9h10v9h6v-9h8v20l-9 6v16H29V40l-7-6zM23 59h36v9H23z" /><path d="M30 33h24" fill="none" /></>}
    {type === 'n' && <><path d="m24 56 7-16 15-11-16 4-9-6 13-13 10 3 7-7 3 14 9 17-7 15zM23 59h35v9H23z" /><circle cx="43" cy="24" r="2" className="chess-piece-detail" stroke="none" /></>}
    {type === 'b' && <><path d="m40 10 15 22-10 15 9 10H26l9-10-10-15zM23 60h34v8H23z" /><path d="m44 23-9 16" fill="none" /></>}
    {type === 'q' && <><path d="m19 20 13 14 8-20 8 20 13-14-9 37H28zM24 60h32v8H24z" /><path d="M29 47h22" fill="none" /></>}
    {type === 'k' && <><path d="M40 9v18m-9-9h18" fill="none" strokeWidth="4" /><path d="m27 31 13-7 13 7-7 17 7 9H27l7-9zM23 60h34v8H23z" /></>}
  </>
}

export function LetterPiece({ type }: { type: PieceSymbol }) {
  return <><circle cx="40" cy="39" r="26" /><path d="M24 65h32v5H24z" /><text x="40" y="49" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="31" fontWeight="700" stroke="none" className="chess-piece-detail">{type.toUpperCase()}</text></>
}
