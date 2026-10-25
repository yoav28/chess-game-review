import { ChevronRight, LoaderCircle } from "lucide-react";
import { OpeningExplorer } from "./OpeningExplorer";
import { TablebasePanel } from "./TablebasePanel";
import { MasterExplorer } from "./MasterExplorer";
import { ThreatPanel } from "./ThreatPanel";
import type { ThreatAnalysis } from "../hooks/useThreatAnalysis";
import { createPosition } from "../lib/position";
import { positionOutcome } from "../lib/play-position";
import type { GameRecord } from "../lib/game";
import type { ChessVariant } from "../lib/position";
import type { PositionAnalysis } from "../engine/types";
import { evaluationLabel } from "./EvaluationGraph";
import { AnalysisSearchControls } from './AnalysisSearchControls';
import type { Settings } from '../lib/settings';

type Props = {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  stopped: boolean;
  threads: number;
  onStop: () => void;
  onRun: () => void;
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
  threat: ThreatAnalysis;
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
  threat,
  settings, onSettings, stopped, threads, onStop, onRun,
}: Props) {
  const outcome = positionOutcome(createPosition(fen, variant));
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
        {variant === 'threecheck' || variant === 'kingofthehill' || variant === 'atomic' || variant === 'horde' || variant === 'crazyhouse' || variant === 'giveaway' ? 'Fairy-Stockfish · classical evaluation · W = forced win' : 'Stockfish 19 Lite'} {analysis ? `· depth ${analysis.depth}` : ""}
        {busy && <LoaderCircle className="spin inline-icon" size={13} />}
      </p>
      <AnalysisSearchControls settings={settings} onChange={onSettings} busy={busy} stopped={stopped} threads={threads} onStop={onStop} onRun={onRun} />
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
          {outcome && <p className="engine-empty" role="status">{outcome} No continuation is available from this ended position.</p>}
          {analysis?.lines.map((line) => (
            <div className="engine-line" key={line.rank}>
              <strong>{evaluationLabel(line.evaluation, variant)}</strong>
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
                : stopped
                  ? "Analysis stopped before a scored line. Analyze again to continue."
                : "Select a position to analyze."}
            </p>
          )}
        </div>
      ) : (
        <p className="engine-empty">
          Turn on the engine to explore candidate lines.
        </p>
      )}
      <ThreatPanel threat={threat} />
      <div className="analysis-tip">
        <button className="secondary full-width" disabled={!!outcome} onClick={onPlay}>Play this position against {variant === 'threecheck' || variant === 'kingofthehill' || variant === 'atomic' || variant === 'horde' || variant === 'crazyhouse' || variant === 'giveaway' ? 'Fairy-Stockfish' : 'Stockfish'}</button>
        <h3>Try a different move</h3>
        <p>
          Move any piece on the board to explore a legal variation. Right-click
          and drag to draw arrows.
        </p>
      </div>
      <OpeningExplorer games={games} fen={fen} variant={variant} onMove={onExploreMove} />
      <MasterExplorer fen={fen} variant={variant} onMove={onExploreMove} />
      <TablebasePanel fen={fen} disabled={variant !== 'chess'} onMove={onExploreMove} />
      <details className="position-details">
        <summary>Current position · FEN</summary>
        <code>{fen}</code>
      </details>
    </div>
  );
}
