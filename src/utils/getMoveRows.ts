import type { Move } from 'chess.js';

interface MoveRow {
  number: number;
  white?: { move: Move; index: number };
  black?: { move: Move; index: number };
}

export default function getMoveRows(history: Move[]) {
  const rows: MoveRow[] = [];

  history.forEach((move, index) => {
    const number = Number(move.before.split(' ')[5]);
    if (!rows.length || rows.at(-1)!.number !== number)
      rows.push({ number });
    rows.at(-1)![move.color === 'w' ? 'white' : 'black'] = { move, index };
  });

  return rows;
}
