import { ChevronRight, LoaderCircle } from "lucide-react";
import { OpeningExplorer } from "./OpeningExplorer";
import { TablebasePanel } from "./TablebasePanel";
import type { GameRecord } from "../lib/game";
import type { ChessVariant } from "../lib/position";
import type { PositionAnalysis } from "../engine/types";
import { evaluationLabel } from "./EvaluationGraph";

type Props = {
  variant: ChessVariant;
  games: GameRecord[];
  onExploreMove: (uci: string) => void;
  onPlay: () => void;
  analysis: PositionAnalysis | null;
  busy: boolean;
  error: string;
  enabled: boolean;
  onToggle: () => void;
  onLine: (moves: string[]) => void;
  variation: string[];
  onBack: () => void;
  fen: string;
};

export function AnalysisPanel({
  variant,
  games,
  onExploreMove,
  onPlay,
  analysis,
  busy,
  error,
  enabled,
  onToggle,
  onLine,
  variation,
  onBack,
  fen,
}: Props) {
  return (
    <div className="analysis-content">
      <div className="report-caption">
        <h2>Engine analysis</h2>
        <button
          className={`toggle ${enabled ? "on" : ""}`}
          role="switch"
          aria-checked={enabled}
          aria-label="Live engine analysis"
          onClick={onToggle}
        >
          <span />
        </button>
      </div>
      <p className="muted">
        Stockfish 19 Lite {analysis ? `· depth ${analysis.depth}` : ""}
        {busy && <LoaderCircle className="spin inline-icon" size={13} />}
      </p>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {variation.length > 0 && (
        <div className="variation-banner">
          <span>Variation · {variation.join(" ")}</span>
          <button className="text-button" onClick={onBack}>
            Return to game
          </button>
        </div>
      )}
      {enabled ? (
        <div className="engine-lines">
          {analysis?.lines.map((line) => (
            <div className="engine-line" key={line.rank}>
              <strong>{evaluationLabel(line.evaluation)}</strong>
              <div className="pv-moves">
                {line.pvSan.slice(0, 12).map((san, index) => (
                  <button
                    key={index}
                    onClick={() => onLine(line.pv.slice(0, index + 1))}
                    title={`Play line through ${san}`}
                  >
                    {san}
                  </button>
                ))}
              </div>
              <ChevronRight size={15} />
            </div>
          )) ?? (
            <p className="engine-empty">
              {busy
                ? "Finding the strongest continuations…"
                : "Select a position to analyze."}
            </p>
          )}
        </div>
      ) : (
        <p className="engine-empty">
          Turn on the engine to explore three candidate lines.
        </p>
      )}
      <div className="analysis-tip">
        <button className="secondary full-width" onClick={onPlay}>Play this position against Stockfish</button>
        <h3>Try a different move</h3>
        <p>
          Move any piece on the board to explore a legal variation. Right-click
          and drag to draw arrows.
        </p>
      </div>
      <OpeningExplorer games={games} fen={fen} variant={variant} onMove={onExploreMove} />
      <TablebasePanel fen={fen} disabled={variant !== 'chess'} onMove={onExploreMove} />
      <details className="position-details">
        <summary>Current position · FEN</summary>
        <code>{fen}</code>
      </details>
    </div>
  );
}
