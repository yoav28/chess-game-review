import { useMemo } from "react";
import { createPosition } from "../lib/position";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Menu,
  Pause,
  Play,
  X,
} from "lucide-react";
import Board from "./Board";
import { EvaluationGraph, evaluationLabel } from "./EvaluationGraph";
import { formatTimeControl } from "./GameLibrary";
import { MoveList } from "./MoveList";
import { PlayerBar } from "./PlayerBar";
import { demoGame } from "../lib/demo";
import type { GameRecord, ParsedGame } from "../lib/game";
import type { Classification, GameReview } from "../lib/review";
import { downloadText } from "../lib/storage";
import type { Evaluation } from "../engine/types";

type BoardWorkspaceProps = {
  game: GameRecord;
  parsed: ParsedGame & { error: string };
  review: GameReview | null;
  ply: number;
  orientation: "w" | "b";
  practice: boolean;
  opening: string;
  fen: string;
  lastMove?: { from: string; to: string };
  bestMove?: string;
  showBestMove: boolean;
  coachArrows: { from: string; to: string }[];
  threatArrow?: { from: string; to: string };
  classification?: { square: string; kind: Classification };
  showTimeSpent: boolean;
  disabled: boolean;
  evaluation?: Evaluation;
  playing: boolean;
  isVariation: boolean;
  variationSans: string[];
  onOpenLibrary: () => void;
  onMove: (uci: string) => void;
  onFlip: () => void;
  onCopyPosition: () => void;
  onNavigate: (ply: number) => void;
  onAutoplay: () => void;
  onUndoVariation: () => void;
  onReturnToGame: () => void;
  onSelectMove: (ply: number) => void;
};

export function BoardWorkspace({
  game,
  parsed,
  review,
  ply,
  orientation,
  practice,
  opening,
  fen,
  lastMove,
  bestMove,
  showBestMove,
  coachArrows,
  threatArrow,
  classification,
  showTimeSpent,
  disabled,
  evaluation,
  playing,
  isVariation,
  variationSans,
  onOpenLibrary,
  onMove,
  onFlip,
  onCopyPosition,
  onNavigate,
  onAutoplay,
  onUndoVariation,
  onReturnToGame,
  onSelectMove,
}: BoardWorkspaceProps) {
  const board = useMemo(() => createPosition(fen, parsed.variant), [fen, parsed.variant]);
  const whitePercent = evaluation
    ? 50 + Math.tanh(evaluation.cp / 500) * 48
    : 50;
  const sample = game.id === demoGame.id;

  return (
    <main className="board-workspace">
      <div className="workspace-heading">
        <div>
          <button
            className="icon-button mobile-library"
            onClick={onOpenLibrary}
            aria-label="Open game library"
          >
            <Menu size={19} />
          </button>
          <h1>
            {sample
              ? "The Opera Game"
              : `${game.white.username} vs ${game.black.username}`}
          </h1>
          {sample && <span className="sample-label">Sample game</span>}
        </div>
        <span>
          {sample
            ? "Paris, 1858"
            : game.endTime
              ? new Date(game.endTime * 1000).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Imported game"}
        </span>
      </div>
      <div className="game-meta">
        <span>
          <BookOpen size={14} />
          {opening}
        </span>
        <span>
          {formatTimeControl(game.timeControl)}
          {parsed.result !== "*" ? ` · ${parsed.result}` : ""}
        </span>
      </div>
      {parsed.error ? (
        <div className="unsupported-game">
          <h2>Game imported</h2>
          <p>{parsed.error}</p>
          <button
            className="secondary"
            onClick={() => downloadText(game.pgn, "game.pgn")}
          >
            <Download size={16} /> Export PGN
          </button>
        </div>
      ) : (
        <>
          <div className="board-area">
            <div className="board-player-top">
              <PlayerBar
                hideClock={practice || isVariation}
                color={orientation === "w" ? "b" : "w"}
                game={game}
                parsed={parsed}
                ply={ply}
                review={review}
                board={board}
              />
            </div>
            <div className="board-with-eval">
              <div
                className={`evaluation-bar ${orientation === "b" ? "flipped" : ""}`}
                aria-label={`Evaluation ${evaluationLabel(evaluation, parsed.variant)}`}
              >
                <div
                  className="white-evaluation"
                  style={{ height: `${whitePercent}%` }}
                />
                <span
                  className={
                    evaluation && evaluation.cp < 0 ? "dark-score" : ""
                  }
                >
                  {evaluationLabel(evaluation, parsed.variant)}
                </span>
              </div>
              <Board
                variant={parsed.variant}
                fen={fen}
                orientation={orientation}
                lastMove={lastMove}
                bestMove={bestMove}
                showBestMove={showBestMove}
                coachArrows={coachArrows}
                threatArrow={threatArrow}
                classification={classification}
                onMove={onMove}
                disabled={disabled}
              />
            </div>
            <div className="board-player-bottom">
              <PlayerBar
                hideClock={practice || isVariation}
                color={orientation}
                game={game}
                parsed={parsed}
                ply={ply}
                review={review}
                board={board}
              />
            </div>
          </div>
          <div className="board-toolbar">
            <div>
              <button
                className="icon-button"
                onClick={onFlip}
                title="Flip board (F)"
                aria-label="Flip board"
              >
                <ArrowLeftRight size={18} />
              </button>
              <button
                className="icon-button"
                onClick={onCopyPosition}
                title="Copy FEN"
                aria-label="Copy current position"
              >
                <Copy size={17} />
              </button>
              <button
                className="icon-button"
                onClick={() =>
                  downloadText(
                    game.pgn,
                    `${game.white.username}-${game.black.username}.pgn`,
                  )
                }
                title="Download PGN"
                aria-label="Download PGN"
              >
                <ArrowDownToLine size={18} />
              </button>
            </div>
            <div className="move-controls">
              <button
                className="icon-button"
                onClick={() => onNavigate(0)}
                disabled={ply === 0 || practice}
                aria-label="First move"
              >
                <ChevronFirst size={22} />
              </button>
              <button
                className="icon-button"
                onClick={() => onNavigate(ply - 1)}
                disabled={ply === 0 || practice}
                aria-label="Previous move"
              >
                <ChevronLeft size={25} />
              </button>
              <button
                className="icon-button autoplay"
                onClick={onAutoplay}
                disabled={practice}
                aria-label={playing ? "Pause game" : "Play game"}
              >
                {playing ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
              <button
                className="icon-button"
                onClick={() => onNavigate(ply + 1)}
                disabled={ply === parsed.moves.length || practice}
                aria-label="Next move"
              >
                <ChevronRight size={25} />
              </button>
              <button
                className="icon-button"
                onClick={() => onNavigate(parsed.moves.length)}
                disabled={ply === parsed.moves.length || practice}
                aria-label="Last move"
              >
                <ChevronLast size={22} />
              </button>
            </div>
            <span className="move-position">
              {ply} / {parsed.moves.length}
            </span>
          </div>
          {isVariation && !practice && (
            <div className="variation-toolbar">
              <span>Variation: {variationSans.join(" ")}</span>
              <button className="text-button" onClick={onUndoVariation}>
                <ArrowLeft size={13} /> Undo
              </button>
              <button className="text-button" onClick={onReturnToGame}>
                Return to game <X size={13} />
              </button>
            </div>
          )}
          <EvaluationGraph review={review} ply={ply} onSelect={onSelectMove} />
          <div className="moves-heading">
            <h2>Moves</h2>
            <span>
              {parsed.moves.length} half-moves{" "}
              <span className="keyboard-hint">· use ← → to navigate</span>
            </span>
          </div>
          <MoveList
            parsed={parsed}
            timeControl={game.timeControl}
            timeClass={game.timeClass}
            showTimeSpent={showTimeSpent}
            moves={parsed.moves}
            review={review}
            ply={ply}
            onSelect={onSelectMove}
          />
        </>
      )}
    </main>
  );
}
