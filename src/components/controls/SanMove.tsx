import type { Color } from 'chess.js';

const figurines: Record<Color, Record<string, string>> = {
  w: { K: 'Ā', Q: 'Į', R: 'Ľ', B: 'Ă', N: 'Ç' },
  b: { K: 'Ą', Q: 'Ķ', R: 'Ļ', B: 'Ä', N: 'Ė' },
};

export default function SanMove({ san, color }: { san: string; color: Color }) {
  return (
    <span className="move-notation">
      {san.split(/([KQRBN])/).map((part, index) => figurines[color][part]
        ? (
            <span key={index}>
              <span className="sr-only">{part}</span>
              <span aria-hidden="true" className="move-notation-piece">{figurines[color][part]}</span>
            </span>
          )
        : <span key={index}>{part}</span>)}
    </span>
  );
}
