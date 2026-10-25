import {
  BookOpen,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  RotateCcw,
  Square,
} from "lucide-react";
import { engineRules, type GameRecord, type ParsedGame } from "../lib/game";
import {
  classificationLabels,
  type GameReview,
  type MoveReview,
} from "../lib/review";
import type { ReviewProgress } from "../engine/types";
import { isVariantHeuristic, variantLabel } from "../lib/variants";
import MoveClassification from "./move-classifications/MoveClassification";
import { PlayerAvatar } from "./PlayerAvatar";
import { EvaluationGraph, evaluationLabel } from "./EvaluationGraph";
import { MoveList } from "./MoveList";
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
  parsed: ParsedGame & { error: string };
  ply: number;
  showTimeSpent: boolean;
  games: readonly GameRecord[];
  username: string;
  review: GameReview | null;
  move: MoveReview | undefined;
  running: boolean;
  progress: ReviewProgress | null;
  error: string;
  onStart: () => void;
  onCancel: () => void;
  onSelect: (ply: number) => void;
  onExploreOpening: (ply: number) => void;
  onPractice: (color?: 'all' | 'w' | 'b') => void;
  onPracticePosition: (ply: number) => void;
  onExplain: () => void;
  preferredColor?: 'w' | 'b';
  settings: Settings;
  moveReview: boolean;
  onMoveReview: (mode: 'overview' | 'moves') => void;
  onSettings: (settings: Settings) => void;
  onBestLine: () => void;
  onShowLine: (line: string[]) => void;
  onMethod: () => void;
  onImportReport: (review: GameReview) => void;
  orientation: 'w' | 'b';
};

export function ReviewPanel({
  game,
  parsed,
  ply,
  showTimeSpent,
  games,
  username,
  review,
  move,
  running,
  progress,
  error,
  onStart,
  onCancel,
  onSelect,
  onExploreOpening,
  onPractice,
  onPracticePosition,
  onExplain,
  preferredColor,
  settings,
  moveReview,
  onMoveReview,
  onSettings,
  onBestLine,
  onShowLine,
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
  const retryableMove = move && ['inaccuracy', 'mistake', 'blunder', 'missed'].includes(move.classification)
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
          <button
            className="primary full-width"
            onClick={onStart}
            disabled={running || !engineRules(game.rules)}
          >
            {running ? "Analyzing…" : "Start Review"}{" "}
            <ArrowRight size={17} />
          </button>
          <details className="review-move-section">
            <summary><span>Game moves</span><span>{parsed.moves.length} half-moves</span></summary>
            <MoveList
              parsed={parsed}
              timeControl={game.timeControl}
              timeClass={game.timeClass}
              showTimeSpent={showTimeSpent}
              moves={parsed.moves}
              review={null}
              ply={ply}
              onSelect={onSelect}
            />
          </details>
        </div>
      ) : moveReview ? (
        <ReviewMoveStep
          game={game}
          parsed={parsed}
          review={review}
          move={move}
          ply={ply}
          showTimeSpent={showTimeSpent}
          settings={settings}
          onBack={() => onMoveReview('overview')}
          onSelect={onSelect}
          onPracticePosition={onPracticePosition}
        />
      ) : (
        <>
          {review.importedAt && <p className="fine-print" role="note">Imported report. Scores and explanations came from the file; no engine analysis was rerun here. Use Review again to calculate a new report.</p>}
          {settings.showCoachAvatar && (
            <div className="review-coach">
              <img className="review-coach-avatar" src="/coach/hikaru.png" alt="" />
              <div className="review-coach-bubble">Let’s look at the key moments from this game.</div>
            </div>
          )}
          <div className="review-analysis-graph">
            <EvaluationGraph review={review} ply={move?.ply ?? 0} onSelect={onSelect} />
          </div>
          <div className="accuracy-report">
            <div className="report-caption">
              <h2>Accuracy</h2>
              <button className="text-button help-method" onClick={onMethod}>
                How it’s measured
              </button>
            </div>
            <p className="fine-print">{review.variant && isVariantHeuristic(review.variant) ? `${variantLabel(review.variant)} move-quality heuristic · v2. Not calibrated winning probabilities.` : review.accuracyVersion === 2 ? 'Win-chance accuracy · v2' : 'Legacy centipawn accuracy · v1. Review again to update.'}</p>
            <div className="review-player-comparison">
              <span className="review-comparison-label">Players</span>
              <div className="review-player-score review-player-score-0">
                <p className="review-player-name">{game.white.username}</p>
                <PlayerAvatar className="review-player-avatar" color="w" name={game.white.username} size={64} />
              </div>
              <div className="review-player-score review-player-score-1">
                <p className="review-player-name">{game.black.username}</p>
                <PlayerAvatar className="review-player-avatar" color="b" name={game.black.username} size={64} />
              </div>
              <span className="review-comparison-label review-accuracy-label">Accuracy</span>
              <strong className="review-accuracy review-accuracy-white">{review.whiteAccuracy?.toFixed(1) ?? "—"}</strong>
              <strong className="review-accuracy review-accuracy-black">{review.blackAccuracy?.toFixed(1) ?? "—"}</strong>
            </div>
          </div>
          <ReviewOverview review={review} games={games} username={username} onSelect={onSelect} onExploreOpening={onExploreOpening} />
          <div className="review-preferences"><label htmlFor="review-focus">Highlights for</label><select id="review-focus" value={focusColor} onChange={event => setFocusColor(event.target.value as 'all' | 'w' | 'b')}><option value="all">Both players</option><option value="w">White</option><option value="b">Black</option></select></div>
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
                <MoveClassification className="classification-icon" classification={move.classification} />
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
              {move.alternativeLine?.pv.length ? <button className="text-button" title={`Second engine line: ${move.alternativeLine.pvSan.slice(0, 6).join(' ')}`} onClick={() => onShowLine(move.alternativeLine!.pv)}>Explore second engine line <ChevronRight size={14} /></button> : null}
              {retryableMove && move && <button className="text-button" onClick={() => onPracticePosition(move.ply)}><RotateCcw size={14} /> Retry this move</button>}
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
                    <MoveClassification className="move-glyph-icon" classification={moment.classification} />
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
          <details className="review-move-section">
            <summary><span>Game moves</span><span>{parsed.moves.length} half-moves</span></summary>
            <MoveList
              parsed={parsed}
              timeControl={game.timeControl}
              timeClass={game.timeClass}
              showTimeSpent={showTimeSpent}
              moves={parsed.moves}
              review={review}
              ply={ply}
              onSelect={onSelect}
            />
          </details>
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
          <div className="review-overview-footer">
            <button className="primary full-width review-start-button" onClick={() => onMoveReview('moves')}>
              Start Review <ArrowRight size={21} />
            </button>
          </div>
        </>
      )}
      {!engineRules(game.rules) && (
        <p className="error-message">
          This is a {game.rules} game. Its PGN is available for export; this
          engine reviews standard chess, material odds, Chess960, three-check, King of the Hill, Atomic, Horde, and Crazyhouse.
        </p>
      )}
    </div>
  );
}

function ReviewMoveStep({
  game,
  parsed,
  review,
  move,
  ply,
  showTimeSpent,
  settings,
  onBack,
  onSelect,
  onPracticePosition,
}: {
  game: GameRecord;
  parsed: ParsedGame;
  review: GameReview;
  move: MoveReview | undefined;
  ply: number;
  showTimeSpent: boolean;
  settings: Settings;
  onBack: () => void;
  onSelect: (ply: number) => void;
  onPracticePosition: (ply: number) => void;
}) {
  const finished = ply >= review.moves.length;
  const retryable = move && ['inaccuracy', 'mistake', 'blunder', 'missed'].includes(move.classification);
  const message = move
    ? coachText(move, settings.coachDetail, settings.coachProfile)
    : 'Choose Next to review the first move, or move a piece to explore the position.';
  const title = move
    ? `${move.san} is ${classificationLabels[move.classification] === 'Book' ? 'a book move' : `a ${classificationLabels[move.classification].toLowerCase()}`}`
    : 'Starting Position';
  const evaluation = move?.beforeEvaluation ?? review.initialAnalysis.evaluation;

  return (
    <div className="review-step-panel">
      {settings.showCoachAvatar ? (
        <div className="review-coach review-step-coach">
          <img className="review-coach-avatar" src="/coach/hikaru-review.png" alt="" />
          <div className="review-coach-bubble">
            <div className="review-step-title">
              {move && <MoveClassification className="review-step-icon" classification={move.classification} />}
              <strong>{title}</strong>
              <span className={`review-evaluation ${evaluation.cp < 0 ? 'review-evaluation-black' : ''}`}>
                {evaluationLabel(evaluation, move?.variant)}
              </span>
            </div>
            <p className="review-step-explanation">{message}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="review-step-title">
            {move && <MoveClassification className="review-step-icon" classification={move.classification} />}
            <strong>{title}</strong>
            <span className={`review-evaluation ${evaluation.cp < 0 ? 'review-evaluation-black' : ''}`}>
              {evaluationLabel(evaluation, move?.variant)}
            </span>
          </div>
          <p className="review-step-explanation">{message}</p>
        </>
      )}
      <div className="review-step-actions">
        {retryable && move && <button className="secondary review-step-retry" onClick={() => onPracticePosition(move.ply)}><RotateCcw size={15} /> Retry</button>}
        <button className="primary review-step-next" onClick={() => finished ? onBack() : onSelect(ply + 1)}>
          <ArrowRight size={20} /> {finished ? 'Finish Review' : 'Next'}
        </button>
      </div>
      <div className="review-opening">
        <span>{ply === 0 ? 'Starting Position' : review.opening?.name ?? 'Starting Position'}</span>
        <BookOpen size={18} />
      </div>
      <div className="review-game-heading"><strong>{game.white.username}<span>–</span>{game.black.username}</strong><span>{review.result}</span></div>
      <details className="review-move-section review-step-moves" open>
        <summary><span>Game moves</span><span>{parsed.moves.length} half-moves</span></summary>
        <MoveList parsed={parsed} timeControl={game.timeControl} timeClass={game.timeClass} showTimeSpent={showTimeSpent} moves={parsed.moves} review={review} ply={ply} onSelect={onSelect} />
      </details>
      <div className="review-analysis-graph"><EvaluationGraph review={review} ply={ply} onSelect={onSelect} /></div>
    </div>
  );
}
