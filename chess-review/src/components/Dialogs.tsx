import { useEffect, useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { Chess, validateFen } from "chess.js";
import { gameFromPgn, type GameRecord } from "../lib/game";

export type Settings = {
  depth: number;
  timeMs: number;
  showArrows: boolean;
  sound: boolean;
};
export type DialogName = "import" | "settings" | "method" | null;

export function Dialogs({
  dialog,
  onClose,
  settings,
  onSettings,
  onImport,
}: {
  dialog: DialogName;
  onClose: () => void;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onImport: (game: GameRecord) => void;
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
        const valid = validateFen(source);
        if (!valid.ok) throw new Error(valid.error);
        const board = new Chess(source);
        board.setHeader("Event", "Position analysis");
        board.setHeader("White", "White");
        board.setHeader("Black", "Black");
        source = board.pgn();
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
              Standard chess. For multiple games, paste one game at a time.
            </p>
          </>
        ) : dialog === "settings" ? (
          <>
            <label htmlFor="review-depth">
              Maximum engine depth <strong>{settings.depth}</strong>
            </label>
            <input
              id="review-depth"
              type="range"
              min="10"
              max="22"
              value={settings.depth}
              onChange={(e) =>
                onSettings({ ...settings, depth: Number(e.target.value) })
              }
            />
            <label htmlFor="review-time">
              Time per position <strong>{settings.timeMs / 1000}s</strong>
            </label>
            <select
              id="review-time"
              value={settings.timeMs}
              onChange={(e) =>
                onSettings({ ...settings, timeMs: Number(e.target.value) })
              }
            >
              <option value="150">Quick · 0.15 seconds</option>
              <option value="500">Balanced · 0.5 seconds</option>
              <option value="1500">Deep · 1.5 seconds</option>
              <option value="5000">Thorough · 5 seconds</option>
            </select>
            <p className="fine-print">
              Analysis stops at the depth or time limit, whichever comes first.
              More time can change move labels and scores.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.showArrows}
                onChange={(e) =>
                  onSettings({ ...settings, showArrows: e.target.checked })
                }
              />{" "}
              Show engine arrows
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) =>
                  onSettings({ ...settings, sound: e.target.checked })
                }
              />{" "}
              Move sounds
            </label>
            <p className="fine-print">
              Changes apply to the next review. Existing reviews remain saved.
            </p>
            <button className="primary full-width" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <div className="method-copy">
            <p>
              Open File is an independent chess review app. Stockfish 19 Lite
              runs on your device; games come from Chess.com’s public archives.
            </p>
            <h3>Accuracy and move labels</h3>
            <p>
              Our accuracy score is the average of 100 × e
              <sup>−centipawn loss / 250</sup> for each player’s moves. It is a
              separate metric from Chess.com’s proprietary score.
            </p>
            <p>
              Move labels compare the played move with Stockfish’s first choice:
              excellent (≤20 centipawns lost), good (≤60), inaccuracy (≤120),
              mistake (≤250), and blunder (&gt;250). A lost winning advantage
              can be a missed opportunity.
            </p>
            <p>
              Book moves match a small local opening reference. Great moves and
              brilliant sacrifices use conservative engine and material
              heuristics; they are not Chess.com’s definitions. A low analysis
              budget may leave these labels unavailable.
            </p>
            <h3>Explanations and limitations</h3>
            <p>
              Explanations describe the legal move, evaluation change, and
              best-play continuation. They are generated from chess rules and
              engine results. Deeper analysis may find a different continuation.
            </p>
            <p>
              Imported variants are retained, but this engine reviews standard
              chess. Public archives contain completed games and may update with
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
          </div>
        )}
      </section>
    </dialog>
  );
}
