import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Square,
  Target,
} from "lucide-react";
import type { GameRecord } from "../lib/game";
import {
  classificationLabels,
  type GameReview,
  type MoveReview,
} from "../lib/review";
import type { ReviewProgress } from "../engine/types";
import { classificationGlyph } from "./MoveList";
import { evaluationLabel } from "./EvaluationGraph";
import { CoachControls } from "./CoachControls";
import { SkillBreakdown } from "./SkillBreakdown";
import { ReviewStats } from "./ReviewStats";
import { plainTextReport, reviewedPgn } from "../lib/report";
import { downloadText } from "../lib/storage";
import { useState } from "react";

type Props = {
  game: GameRecord;
  review: GameReview | null;
  move: MoveReview | undefined;
  running: boolean;
  progress: ReviewProgress | null;
  error: string;
  onStart: () => void;
  onCancel: () => void;
  onSelect: (ply: number) => void;
  onPractice: () => void;
  onBestLine: () => void;
  onMethod: () => void;
};

export function ReviewPanel({
  game,
  review,
  move,
  running,
  progress,
  error,
  onStart,
  onCancel,
  onSelect,
  onPractice,
  onBestLine,
  onMethod,
}: Props) {
  const [shareNotice, setShareNotice] = useState("");
  const mistakes =
    review?.moves.filter((m) =>
      ["inaccuracy", "mistake", "blunder", "missed"].includes(m.classification),
    ) ?? [];
  return (
    <div className="review-content">
      {running && (
        <div className="review-progress" role="status">
          <div>
            <strong>Reviewing your game</strong>
            <button className="text-button" onClick={onCancel}>
              <Square size={12} /> Stop
            </button>
          </div>
          <p>
            {progress?.completed ?? 0} of {progress?.total || "…"} positions ·{" "}
            {progress?.percent ?? 0}%
          </p>
          <progress value={progress?.percent ?? 0} max="100" />
          <span>Stockfish is checking each position on your device.</span>
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {!review ? (
        <div className="review-intro">
          <div className="review-intro-symbol">
            <Sparkles size={29} strokeWidth={1.4} />
          </div>
          <h2>Review this game</h2>
          <p>
            Check every move, find the turning points, and practice the moves
            you missed.
          </p>
          <div className="review-features">
            <span>
              <Target size={16} /> Accuracy & move quality
            </span>
            <span>
              <Lightbulb size={16} /> Explanations & best lines
            </span>
            <span>
              <RotateCcw size={16} /> Practice your mistakes
            </span>
          </div>
          <button
            className="primary full-width"
            onClick={onStart}
            disabled={running || game.rules !== "chess"}
          >
            {running ? "Analyzing…" : "Review this game"}{" "}
            <ArrowRight size={17} />
          </button>
          <p className="fine-print">
            Local Stockfish analysis. No review limit.
          </p>
        </div>
      ) : (
        <>
          <div className="accuracy-report">
            <div className="report-caption">
              <h2>Accuracy</h2>
              <button className="text-button help-method" onClick={onMethod}>
                How it’s measured
              </button>
            </div>
            <div className="accuracy-players">
              <div>
                <span className="player-dot white" />
                <span>{game.white.username}</span>
                <strong>{review.whiteAccuracy?.toFixed(1) ?? "—"}</strong>
              </div>
              <div>
                <span className="player-dot black" />
                <span>{game.black.username}</span>
                <strong>{review.blackAccuracy?.toFixed(1) ?? "—"}</strong>
              </div>
            </div>
          </div>
          <CoachControls
            key={game.id}
            review={review}
            move={move}
            onSelect={onSelect}
          />
          {move && (
            <section className="coach">
              <div className="coach-title">
                <span
                  className={`classification-symbol ${move.classification}`}
                >
                  {classificationGlyph[move.classification]}
                </span>
                <div>
                  <h3>
                    {move.beforeFen.split(' ')[5]}
                    {move.color === "w" ? "." : "…"} {move.san}{" "}
                    <span>{classificationLabels[move.classification]}</span>
                  </h3>
                  <span>
                    {evaluationLabel(move.beforeEvaluation)}{" "}
                    <ArrowRight size={11} /> {evaluationLabel(move.evaluation)}
                  </span>
                </div>
              </div>
              <p>{move.explanation}</p>
              {move.bestMove && (
                <button className="secondary full-width" onClick={onBestLine}>
                  {move.bestMove === move.uci ? 'Explore the continuation' : `Show ${move.bestMoveSan}, the best move`}{" "}
                  <ChevronRight size={16} />
                </button>
              )}
            </section>
          )}
          <ReviewStats review={review} ply={move?.ply} onSelect={onSelect} />
          <SkillBreakdown review={review} />
          <section className="moments">
            <div className="report-caption">
              <h3>Key moments</h3>
              <span>{review.keyMoments.length}</span>
            </div>
            {review.keyMoments.length ? (
              review.keyMoments.map((ply) => {
                const moment = review.moves[ply - 1];
                return (
                  <button
                    key={ply}
                    onClick={() => onSelect(ply)}
                    className={move?.ply === ply ? "active" : ""}
                  >
                    <i className={`move-glyph ${moment.classification}`}>
                      {classificationGlyph[moment.classification]}
                    </i>
                    <span>
                      <strong>
                        {moment.beforeFen.split(' ')[5]}
                        {moment.color === "w" ? "." : "…"} {moment.san}
                      </strong>
                      <span>
                        {classificationLabels[moment.classification]} ·{" "}
                        {moment.color === "w" ? "White" : "Black"}
                      </span>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                );
              })
            ) : (
              <p className="muted">No major evaluation swings in this game.</p>
            )}
          </section>
          <button
            className="primary full-width practice-action"
            onClick={onPractice}
            disabled={!mistakes.length}
          >
            <RotateCcw size={17} /> Practice {mistakes.length} missed moves
          </button>
          <div className="report-export">
            <button
              className="secondary"
              onClick={() =>
                downloadText(
                  reviewedPgn(review),
                  `${game.white.username}-${game.black.username}-review.pgn`,
                )
              }
            >
              Export reviewed PGN
            </button>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(plainTextReport(review));
                  setShareNotice("Review summary copied.");
                } catch {
                  setShareNotice(
                    "Clipboard unavailable. Download the reviewed PGN instead.",
                  );
                }
              }}
            >
              Copy summary
            </button>
          </div>
          {shareNotice && (
            <p className="fine-print" role="status">
              {shareNotice}
            </p>
          )}
          <div className="review-footer">
            <span>{review.engine}</span>
            <button
              className="text-button"
              onClick={onStart}
              disabled={running}
            >
              <RotateCcw size={12} /> Review again
            </button>
          </div>
        </>
      )}
      {game.rules !== "chess" && (
        <p className="error-message">
          This is a {game.rules} game. Its PGN is available for export; this
          engine reviews standard chess.
        </p>
      )}
      {!review && (
        <div className="review-bottom-note">
          <BookOpen size={16} />
          <span>Explore the moves below the board while your review runs.</span>
        </div>
      )}
    </div>
  );
}
