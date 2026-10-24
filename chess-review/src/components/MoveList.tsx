import { useEffect, useRef } from "react";
import type { GameMove, ParsedGame } from "../lib/game";
import { moveTimes } from "../lib/move-time";
import { classificationLabels, type GameReview } from "../lib/review";
import { classificationGlyph } from "../lib/classification";

export { classificationGlyph } from "../lib/classification";

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
                <span>{move.san}</span>
                {showTimeSpent && elapsed[move.ply - 1] != null && <span className="move-time" title="Time spent on this move">{`${elapsed[move.ply - 1]!.toFixed(elapsed[move.ply - 1]! < 10 ? 1 : 0)}s`}</span>}
                {rating && (
                  <span
                    className={`move-glyph ${rating.classification}`}
                    title={classificationLabels[rating.classification]}
                  >
                    {classificationGlyph[rating.classification]}
                  </span>
                )}
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
