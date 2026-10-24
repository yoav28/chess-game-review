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
import { engineRules, type GameRecord } from "../lib/game";
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
import { TrainingPlan } from "./TrainingPlan";
import { ReviewOverview } from "./ReviewOverview";
import { ReviewExports } from "./ReviewExports";
import { coachText, type CoachDetail } from "../lib/coach";
import { plainTextReport, reviewedPgn } from "../lib/report";
import { downloadText } from "../lib/storage";
import { useEffect, useState } from "react";
import type { Settings } from "../lib/settings";

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
  onPractice: (color?: 'all' | 'w' | 'b') => void;
  onPracticePosition: (ply: number) => void;
  onExplain: () => void;
  preferredColor?: 'w' | 'b';
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBestLine: () => void;
  onMethod: () => void;
  onImportReport: (review: GameReview) => void;
  orientation: 'w' | 'b';
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
  onPracticePosition,
  onExplain,
  preferredColor,
  settings,
  onSettings,
  onBestLine,
  onMethod,
  onImportReport,
  orientation,
}: Props) {
  const [shareNotice, setShareNotice] = useState("");
  const defaultFocus = settings.highlight === 'all' || !preferredColor ? 'all' : settings.highlight === 'self' ? preferredColor : preferredColor === 'w' ? 'b' : 'w';
  const [focusColor, setFocusColor] = useState<'all' | 'w' | 'b'>(defaultFocus);
  const coachDetail = settings.coachDetail;
  useEffect(() => setFocusColor(defaultFocus), [defaultFocus]);
  const moments = review?.keyMoments.filter(ply => focusColor === 'all' || review.moves[ply - 1]?.color === focusColor) ?? [];
  const mistakes =
    review?.moves.filter((m) =>
      ["inaccuracy", "mistake", "blunder", "missed"].includes(m.classification) && (focusColor === 'all' || m.color === focusColor),
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
            disabled={running || !engineRules(game.rules)}
          >
            {running ? "Analyzing…" : "Review this game"}{" "}
            <ArrowRight size={17} />
          </button>
          <p className="fine-print">
            Local engine analysis. No review limit.
          </p>
        </div>
      ) : (
        <>
          {review.importedAt && <p className="fine-print" role="note">Imported report. Scores and explanations came from the file; no engine analysis was rerun here. Use Review again to calculate a new report.</p>}
          <div className="accuracy-report">
            <div className="report-caption">
              <h2>Accuracy</h2>
              <button className="text-button help-method" onClick={onMethod}>
                How it’s measured
              </button>
            </div>
            <p className="fine-print">{review.variant === 'threecheck' ? 'Three-check move-quality heuristic · v2. Not calibrated winning probabilities.' : review.accuracyVersion === 2 ? 'Win-chance accuracy · v2' : 'Legacy centipawn accuracy · v1. Review again to update.'}</p>
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
          <ReviewOverview review={review} onSelect={onSelect} />
          <div className="review-preferences"><label htmlFor="review-focus">Highlights for</label><select id="review-focus" value={focusColor} onChange={event => setFocusColor(event.target.value as 'all' | 'w' | 'b')}><option value="all">Both players</option><option value="w">White</option><option value="b">Black</option></select></div>
          {settings.showCoachAvatar && <div className="coach-identity"><span aria-hidden="true">♞</span><span>Open File coach</span></div>}
          <CoachControls
            key={game.id}
            review={review}
            move={move}
            onSelect={onSelect}
            filterColor={focusColor}
            text={move ? coachText(move, coachDetail, settings.coachProfile) : ''}
            profile={settings.coachProfile}
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
                    {evaluationLabel(move.beforeEvaluation, move.variant)}{" "}
                    <ArrowRight size={11} /> {evaluationLabel(move.evaluation, move.variant)}
                  </span>
                </div>
              </div>
              <label className="coach-detail">Explanation style<select aria-label="Explanation style" value={coachDetail} onChange={event => onSettings({ ...settings, coachDetail: event.target.value as CoachDetail })}><option value="detailed">Detailed</option><option value="concise">Concise</option></select></label>
              <p>{coachText(move, coachDetail, settings.coachProfile)}</p>
              <div className="coach-actions"><button className="secondary" onClick={onExplain}><Lightbulb size={15} /> Explain move</button>{move.bestMove && <button className="text-button" onClick={onBestLine}>Analyze {move.bestMoveSan}<ChevronRight size={14} /></button>}</div>
            </section>
          )}
          <ReviewStats review={review} ply={move?.ply} onSelect={onSelect} />
          {settings.showSkills && <SkillBreakdown review={review} />}
          <section className="moments">
            <div className="report-caption">
              <h3>Key moments</h3>
              <span>{moments.length}</span>
            </div>
            {moments.length ? (
              moments.map((ply) => {
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
              <p className="muted">No major evaluation swings for this selection.</p>
            )}
          </section>
          <button
            className="primary full-width practice-action"
            onClick={() => onPractice(focusColor)}
            disabled={!mistakes.length}
          >
            <RotateCcw size={17} /> Practice {mistakes.length} missed moves
          </button>
          {settings.showRecommendations && <TrainingPlan review={review} color={focusColor === 'all' ? preferredColor ?? 'w' : focusColor} onPractice={onPracticePosition} onSelect={onSelect} />}
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
          <ReviewExports review={review} ply={move?.ply ?? 0} orientation={orientation} onImport={onImportReport} />
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
      {!engineRules(game.rules) && (
        <p className="error-message">
          This is a {game.rules} game. Its PGN is available for export; this
          engine reviews standard chess, material odds, Chess960, and three-check.
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
