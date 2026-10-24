import { useEffect, useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { createPosition, resolveVariant } from "../lib/position";
import { gameFromPgn, type GameRecord } from "../lib/game";
import { accuracySource } from "../lib/accuracy";

import type { Settings } from "../lib/settings";
import { ReviewSettings } from "./ReviewSettings";

export type { Settings } from "../lib/settings";
export type DialogName = "import" | "settings" | "method" | null;

export function Dialogs({
  dialog,
  onClose,
  settings,
  onSettings,
  onImport,
  accuracyModel,
  accuracyVersion,
}: {
  dialog: DialogName;
  onClose: () => void;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onImport: (game: GameRecord) => void;
  accuracyModel?: string;
  accuracyVersion?: number;
}) {
  const [pgn, setPgn] = useState("");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = modal.current;
    if (!dialog || !element) return;
    element.showModal();
    return () => element.close();
  }, [dialog]);
  if (!dialog) return null;
  function importText(text: string) {
    try {
      let source = text.trim();
      if (!source) throw new Error("Paste a PGN game or a FEN position first.");
      if (
        source.split(/\s+/)[0].split("/").length === 8 &&
        !source.startsWith("[")
      ) {
        const variant = resolveVariant(source);
        const board = createPosition(source, variant);
        source = `[Event "Position analysis"]\n[White "White"]\n[Black "Black"]\n[Result "*"]\n[SetUp "1"]\n[FEN "${board.fen()}"]${variant === 'threecheck' ? '\n[Variant "3-check"]' : variant === 'chess960' ? '\n[Variant "Chess960"]' : ''}\n\n*`;
      }
      onImport(gameFromPgn(source));
      setPgn("");
      setError("");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <dialog ref={modal} className="modal-backdrop" aria-labelledby="dialog-title" onClick={onClose} onCancel={onClose}>
      <section
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="section-title">
          <h2 id="dialog-title">
            {dialog === "import"
              ? "Load a game or position"
              : dialog === "settings"
                ? "Review settings"
                : "About the analysis"}
          </h2>
          <button
            onClick={onClose}
            className="icon-button"
            aria-label="Close dialog"
            autoFocus
          >
            <X size={19} />
          </button>
        </div>
        {dialog === "import" ? (
          <>
            <label htmlFor="pgn-input">PGN game or FEN position</label>
            <textarea
              id="pgn-input"
              rows={8}
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={
                '[White "Player"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6…'
              }
            />
            <input
              type="file"
              ref={file}
              accept=".pgn,.txt,.fen"
              hidden
              onChange={async (e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                  const text = await selected.text();
                  setPgn(text);
                  importText(text);
                }
                e.target.value = "";
              }}
            />
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => file.current?.click()}
              >
                <Upload size={15} /> Choose file
              </button>
              <button className="primary" onClick={() => importText(pgn)}>
                Load game
              </button>
            </div>
            <p className="fine-print">
              Standard chess, material-odds positions, Chess960, and three-check. For multiple games, paste one game at a time.
            </p>
          </>
        ) : dialog === "settings" ? (
          <ReviewSettings settings={settings} onChange={onSettings} onDone={onClose} />
        ) : (
          <div className="method-copy">
            <p>
              Open File is an independent chess review app. Stockfish 19 Lite and
              the Fairy-Stockfish three-check engine run on your device; games come from Chess.com’s public archives.
            </p>
            <h3>Win-chance accuracy · v2</h3>
            <p>Three-check applies this formula to the variant engine’s scores as an uncalibrated move-quality heuristic. Its numbers are not measured three-check winning probabilities. W denotes a forced win under those rules, and the third check ends the game immediately.</p>
            <p>
              New reviews use Lichess’s published per-move formula. Win chance
              = 100 / (1 + exp(−0.00368208 × centipawns)). Loss is the decrease in
              that chance for the player who moved, measured in percentage points.
            </p>
            <p>
              Move accuracy = clamp(103.1668 × exp(−0.04354 × loss) − 3.1669,
              0, 100). Forced mates map to 100% or 0% by the winning side.
              Engine-best and only legal moves have zero loss to avoid penalties
              from search-depth noise.
            </p>
            <p>
              Game and phase scores are our arithmetic mean of the player’s move
              scores. Lichess uses a different, weighted whole-game calculation.
              These are independent scores, separate from Chess.com’s formula.
            </p>
            <p><a href={accuracySource} target="_blank" rel="noreferrer">Published Lichess accuracy formula ↗</a></p>
            {accuracyModel && <details><summary>Selected report’s saved scoring method{accuracyVersion === 2 ? ' · v2' : ' · legacy v1'}</summary><p>{accuracyModel}</p>{accuracyVersion !== 2 && <p>This saved report retains its original centipawn-based scores and labels. Use Review again to update it to win-chance accuracy.</p>}</details>}
            <h3>Our move labels</h3>
            <p>
              New reviews use winning-chance loss: excellent (≤0.5 percentage
              points), good (≤5), inaccuracy (≤10), mistake (≤20), and blunder
              (&gt;20). A previously found mate falling below 90% winning chance,
              or a chance of at least 60% falling to at most 50% with at least 10
              points lost, can be a Miss under our independent heuristic.
            </p>
            <p>
              Book moves match exact prefixes of 3,865 legally validated lines
              from the Lichess opening database, covering all 500 ECO codes.
              Transposed move orders count only when explicitly registered.
              Great moves and brilliant sacrifices use conservative engine and
              material heuristics; they are not Chess.com’s definitions. A low
              analysis budget may leave these labels unavailable.
            </p>
            <h3>Explanations and limitations</h3>
            <p>
              Explanations describe the legal move, evaluation change, and
              best-play continuation. They are generated from chess rules and
              engine results. Deeper analysis may find a different continuation.
            </p>
            <p>
              This app reviews standard chess, material odds, Chess960, and three-check; other imported
              variants remain available for PGN export. Public archives contain completed games and may update with
              a delay. Browser storage retains games and reviews on this device;
              clearing site data removes them.
            </p>
            <h3>Keyboard controls</h3>
            <p>
              ← / → Previous / next move · Home / End First / last move · Space
              Play / pause · F Flip board. On the board, arrows move focus and
              Enter selects a square.
            </p>
            <a
              href="https://stockfishchess.org/"
              target="_blank"
              rel="noreferrer"
            >
              Stockfish project ↗
            </a>
            <p><a href="https://github.com/lichess-org/chess-openings/tree/a6189a30dc273ccb21fc2536a9a2fefd5592a67a" target="_blank" rel="noreferrer">Lichess opening data · CC0 1.0 ↗</a></p>
          </div>
        )}
      </section>
    </dialog>
  );
}
