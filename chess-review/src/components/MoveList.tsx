import { useEffect, useRef } from "react";
import type { GameMove, ParsedGame } from "../lib/game";
import { moveTimes } from "../lib/move-time";
import { classificationLabels, type GameReview } from "../lib/review";
export { classificationGlyph } from "../lib/classification";
import MoveClassification from "./move-classifications/MoveClassification";

export function MoveList({
  moves,
  review,
  ply,
  onSelect,
  parsed,
  timeControl,
  timeClass,
  showTimeSpent,
}: {
  moves: GameMove[];
  review: GameReview | null;
  ply: number;
  onSelect: (ply: number) => void;
  parsed: ParsedGame;
  timeControl: string;
  timeClass: string;
  showTimeSpent: boolean;
}) {
  const selected = useRef<HTMLButtonElement>(null);
  const elapsed = showTimeSpent ? moveTimes(parsed, timeControl, timeClass) : [];
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = list.current;
    const button = selected.current;
    if (!container || !button) return;
    container.scrollTo({
      top:
        button.offsetTop - container.clientHeight / 2 + button.clientHeight / 2,
      behavior: "smooth",
    });
  }, [ply]);
  const pairs: { number: number; w?: GameMove; b?: GameMove }[] = [];
  for (const move of moves) {
    const number = Number(move.before.split(" ")[5]);
    let row = pairs[pairs.length - 1];
    if (!row || row.number !== number) {
      row = { number };
      pairs.push(row);
    }
    row[move.color] = move;
  }
  return (
    <div ref={list} className="move-list" aria-label="Game moves">
      <button
        className={`starting-position ${ply === 0 ? "active" : ""}`}
        onClick={() => onSelect(0)}
      >
        Starting position
      </button>
      {pairs.map((row) => (
        <div className="move-pair" key={row.number}>
          <span>{row.number}.</span>
          {(["w", "b"] as const).map((color) => {
            const move = row[color];
            const rating = move && review?.moves[move.ply - 1];
            return move ? (
              <button
                key={color}
                ref={move.ply === ply ? selected : undefined}
                className={`move-cell ${ply === move.ply ? "active" : ""}`}
                onClick={() => onSelect(move.ply)}
                aria-label={`Move ${row.number} ${color === "w" ? "White" : "Black"} ${move.san}${rating ? `, ${classificationLabels[rating.classification]}` : ""}`}
              >
                {rating && (
                  <MoveClassification
                    className="move-glyph-icon"
                    classification={rating.classification}
                    aria-label={classificationLabels[rating.classification]}
                  />
                )}
                <Notation color={move.color} san={move.san} />
                {showTimeSpent && elapsed[move.ply - 1] != null && <MoveTime color={move.color} seconds={elapsed[move.ply - 1]!} />}
              </button>
            ) : (
              <span key={color} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

const figurines: Record<GameMove["color"], Record<string, string>> = {
  w: { K: "Ā", Q: "Į", R: "Ľ", B: "Ă", N: "Ç" },
  b: { K: "Ą", Q: "Ķ", R: "Ļ", B: "Ä", N: "Ė" },
};

function Notation({ san, color }: { san: string; color: GameMove["color"] }) {
  return (
    <span className="move-notation">
      {san.split(/([KQRBN])/).map((part, index) => figurines[color][part]
        ? <span key={index}><span className="sr-only">{part}</span><span aria-hidden="true" className="move-notation-piece">{figurines[color][part]}</span></span>
        : <span key={index}>{part}</span>)}
    </span>
  );
}

function MoveTime({ color, seconds }: { color: GameMove["color"]; seconds: number }) {
  return (
    <span className={`move-time move-time-${color}`} title="Time spent on this move">
      <span className="move-time-bar" style={{ width: `${Math.min(32, Math.max(2, seconds))}px` }} />
      <span className="move-time-value">{`${seconds.toFixed(seconds < 10 ? 1 : 0)}s`}</span>
    </span>
  );
}
