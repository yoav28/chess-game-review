import { type Chess, DEFAULT_POSITION } from 'chess.js';

function readTime(comment: string | undefined, annotation: 'clk' | 'emt') {
  const match = comment?.match(new RegExp(`\\[%${annotation}\\s+(\\d+(?::\\d{1,2}){0,2}(?:\\.\\d+)?)\\s*\\]`, 'i'));
  if (!match)
    return null;

  const parts = match[1].split(':').map(Number);
  if (parts.slice(1).some(part => part >= 60))
    return null;

  return parts.reduce((total, part) => total * 60 + part, 0);
}

export default function getMoveTimes(game: Chess): (number | null)[] {
  const history = game.history({ verbose: true });
  const comments = new Map(game.getComments().map(({ fen, comment }) => [fen, comment]));
  const control = game.header().TimeControl?.match(/^(\d+)(?:\+(\d+))?$/);
  const initial = control && history[0]?.before === DEFAULT_POSITION ? Number(control[1]) : null;
  const increment = control ? Number(control[2] ?? 0) : null;
  const remaining: Record<'w' | 'b', number | null> = { w: initial, b: initial };

  return history.map((move) => {
    const comment = comments.get(move.after);
    const clock = readTime(comment, 'clk');
    const explicit = readTime(comment, 'emt');
    const previous = remaining[move.color];

    const calculated = clock !== null && previous !== null && increment !== null
      ? Math.round((previous + increment - clock) * 1000) / 1000
      : null;

    const elapsed = explicit ?? (calculated !== null && calculated >= 0 ? calculated : null);

    remaining[move.color] = clock ?? (previous !== null && explicit !== null && increment !== null
      ? previous + increment - explicit
      : null);

    return elapsed;
  });
}
