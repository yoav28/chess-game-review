import { ArrowRight, Check, Lightbulb, RotateCcw } from "lucide-react";
import type { MoveReview } from "../lib/review";

export function PracticePanel({
  moves,
  index,
  status,
  hint,
  busy,
  feedback,
  onHint,
  onSolution,
  onNext,
  onExit,
}: {
  moves: MoveReview[];
  index: number;
  status: "thinking" | "wrong" | "solved" | "revealed";
  hint: boolean;
  busy: boolean;
  feedback: string;
  onHint: () => void;
  onSolution: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const move = moves[index];
  if (!move)
    return (
      <div className="practice-content">
        <h2>No mistakes to retry</h2>
        <p>
          Run a game review first, then choose a player’s missed moves to
          practice.
        </p>
        <button onClick={onExit} className="secondary">
          Back to review
        </button>
      </div>
    );
  return (
    <div className="practice-content">
      <div className="report-caption">
        <h2>Find the better move</h2>
        <span>
          {index + 1} / {moves.length}
        </span>
      </div>
      <progress
        max={moves.length}
        value={index + (status === "solved" || status === "revealed" ? 1 : 0)}
      />
      <div className="practice-icon">
        <RotateCcw size={30} strokeWidth={1.4} />
      </div>
      <h3>{move.color === "w" ? "White" : "Black"} to move</h3>
      <p>
        At move {move.beforeFen.split(' ')[5]}, {move.san} gave away an opportunity.
        What would you play instead?
      </p>
      {status === "wrong" && (
        <p className="practice-feedback wrong" role="status">
          Try another move to preserve more of the position.
        </p>
      )}
      {status === "solved" && (
        <p className="practice-feedback solved" role="status">
          <Check size={17} /> A strong move. You preserved the position.
        </p>
      )}
      {status === "revealed" && (
        <p className="practice-feedback" role="status">
          The best move is <strong>{move.bestMoveSan}</strong>.
        </p>
      )}
      {busy && <p className="practice-feedback" role="status">Checking your move with Stockfish…</p>}
      {feedback && <p className="practice-analysis-note">{feedback}</p>}
      {hint && status !== "solved" && (
        <p className="hint-message">
          <Lightbulb size={17} /> Look at the piece on{" "}
          {move.bestMove?.slice(0, 2)}.
        </p>
      )}
      {["solved", "revealed"].includes(status) ? (
        <>
          <p className="solution-text">{move.explanation}</p>
          <button className="primary full-width" onClick={onNext}>
            {index + 1 === moves.length ? "Finish practice" : "Next position"}{" "}
            <ArrowRight size={17} />
          </button>
        </>
      ) : (
        <div className="practice-actions">
          <button className="secondary" onClick={onHint} disabled={hint}>
            <Lightbulb size={15} /> Hint
          </button>
          <button className="secondary" onClick={onSolution}>
            Show solution
          </button>
        </div>
      )}
      <button className="text-button practice-exit" onClick={onExit}>
        Return to game review
      </button>
    </div>
  );
}
