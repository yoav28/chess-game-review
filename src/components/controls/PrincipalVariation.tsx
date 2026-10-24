import { Chess } from 'chess.js';

import SanMove from './SanMove';

import type { Move } from 'chess.js';

export default function PrincipalVariation({ fen, moves, limit = 12 }: { fen: string; moves: string[]; limit?: number }) {
  const game = new Chess(fen);
  const line: { move: Move; number: string }[] = [];

  for (const lan of moves.slice(0, limit)) {
    try {
      const turn = game.turn();
      const number = turn === 'w' ? `${game.moveNumber()}.` : line.length === 0 ? `${game.moveNumber()}...` : '';
      line.push({ move: game.move(lan), number });
    }
    catch {
      break;
    }
  }

  return (
    <>
      {line.map(({ move, number }, index) => (
        <span key={`${move.lan}-${index}`}>
          {index > 0 && ' '}
          {number && `${number} `}
          <SanMove color={move.color} san={move.san} />
        </span>
      ))}
    </>
  );
}
