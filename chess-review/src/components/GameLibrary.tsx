import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Search,
  Square,
  X,
} from "lucide-react";
import { engineRules, type GameRecord } from "../lib/game";
import { loadSavedReviews } from "../lib/storage";
import type { useLibrary } from "../hooks/useLibrary";

type Props = {
  library: ReturnType<typeof useLibrary>;
  selectedId: string;
  reviewedGameId?: string;
  onSelect: (game: GameRecord) => void;
  onClose: () => void;
};

const rulesLabel = (rules: string) => rules === 'chess' ? 'Standard' : rules === 'chess960' ? 'Chess960' : rules === 'oddschess' ? 'Odds chess' : rules === 'threecheck' ? 'Three-check' : rules;

export function GameLibrary({ library, selectedId, reviewedGameId, onSelect, onClose }: Props) {
  const [input, setInput] = useState(library.username);
  const [search, setSearch] = useState("");
  const [timeClass, setTimeClass] = useState("all");
  const [result, setResult] = useState("all");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("newest");
  const [month, setMonth] = useState("");
  const [rules, setRules] = useState('all');
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());
  const [reviewedLoaded, setReviewedLoaded] = useState(false);
  const [reviewHistoryError, setReviewHistoryError] = useState(false);
  const pgnFile = useRef<HTMLInputElement>(null);
  const ruleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of library.games) counts.set(game.rules, (counts.get(game.rules) ?? 0) + 1);
    return [...counts].sort(([left], [right]) => left.localeCompare(right));
  }, [library.games]);
  const filtered = useMemo(
    () =>
      library.games
        .filter((game) => {
          const me =
            game.white.username.toLowerCase() === library.username
              ? game.white
              : game.black;
          const outcome =
            me.result === "win"
              ? "win"
              : [
                    "agreed",
                    "repetition",
                    "stalemate",
                    "insufficient",
                    "50move",
                    "timevsinsufficient",
                  ].includes(me.result)
                ? "draw"
                : "loss";
          return (
            (timeClass === "all" || game.timeClass === timeClass) &&
            (result === "all" || result === outcome) &&
            (rules === 'all' || game.rules === rules) &&
            (!month ||
              new Date(game.endTime * 1000).toISOString().slice(0, 7) ===
                month) &&
            `${game.white.username} ${game.black.username}`
              .toLowerCase()
              .includes(search.toLowerCase())
          );
        })
        .sort((a, b) =>
          sort === "oldest" ? a.endTime - b.endTime : b.endTime - a.endTime,
        ),
    [library.games, library.username, search, timeClass, result, sort, month, rules],
  );
  const pages = Math.ceil(filtered.length / 30);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const progress = library.progress;
  const reviewed = useMemo(() => reviewedGameId ? new Set([...reviewedIds, reviewedGameId]) : reviewedIds, [reviewedIds, reviewedGameId]);
  const reviewableGames = useMemo(() => library.games.filter(game => engineRules(game.rules)).sort((a, b) => b.endTime - a.endTime), [library.games]);
  const unreviewedCount = reviewableGames.reduce((count, game) => count + (reviewed.has(game.id) ? 0 : 1), 0);
  const selectedGameUnreviewed = reviewableGames.some(game => game.id === selectedId && !reviewed.has(game.id));

  useEffect(() => {
    const selectedIndex = filtered.findIndex(game => game.id === selectedId);
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / 30));
  }, [filtered, selectedId]);

  useEffect(() => {
    let active = true;
    void loadSavedReviews().then(entries => {
      if (active) {
        setReviewedIds(current => new Set([...current, ...entries.map(entry => entry.id)]));
        setReviewedLoaded(true);
      }
    }).catch(() => {
      if (active) {
        setReviewHistoryError(true);
        setReviewedLoaded(true);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (reviewedGameId) setReviewedIds(current => new Set([...current, reviewedGameId]));
  }, [reviewedGameId]);

  function reviewNextUnreviewed() {
    if (!reviewableGames.length) return;
    const currentIndex = reviewableGames.findIndex(game => game.id === selectedId);
    const order = currentIndex >= 0
      ? [...reviewableGames.slice(currentIndex + 1), ...reviewableGames.slice(0, currentIndex)]
      : reviewableGames;
    const next = order.find(game => !reviewed.has(game.id));
    if (!next) return;
    setSearch("");
    setTimeClass("all");
    setResult("all");
    setRules("all");
    setMonth("");
    setSort("newest");
    setPage(Math.floor(reviewableGames.findIndex(game => game.id === next.id) / 30));
    onSelect(next);
  }

  return (
    <aside className="library" aria-label="Game library">
      <div className="section-title">
        <h2>Your games</h2>
        <button
          className="icon-button close-library"
          onClick={onClose}
          aria-label="Close game library"
        >
          <X size={18} />
        </button>
      </div>
      <form
        className="import-form"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          void library.importUser(input);
        }}
      >
        <label htmlFor="username">Chess.com username</label>
        <div className="input-action">
          <input
            id="username"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Enter username"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button
            className="primary icon-button"
            aria-label="Import all games"
            title="Import all public games"
            disabled={library.loading}
          >
            <ArrowDownToLine size={18} />
          </button>
        </div>
        <p className="fine-print">All public archives. No login needed.</p>
        <input
          ref={pgnFile}
          type="file"
          accept=".pgn,.txt"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) {
              setPage(0);
              await library.importPgn(input, await file.text());
            }
            event.target.value = "";
          }}
        />
        <button className="text-button" type="button" onClick={() => pgnFile.current?.click()}>
          <ArrowDownToLine size={14} /> Add games from PGN
        </button>
        {reviewableGames.length > 0 && <>
          <p className="fine-print">{reviewHistoryError ? 'Saved review history is unavailable.' : reviewedLoaded ? `${reviewableGames.length - unreviewedCount} of ${reviewableGames.length.toLocaleString()} reviewable games reviewed.` : 'Checking saved reviews…'}</p>
          <button className="text-button" type="button" disabled={!reviewedLoaded || reviewHistoryError || !unreviewedCount || selectedGameUnreviewed || library.loading} onClick={reviewNextUnreviewed}>
            {reviewHistoryError ? 'Review history unavailable' : !reviewedLoaded ? 'Checking saved reviews…' : selectedGameUnreviewed ? 'Review this game to continue' : unreviewedCount ? `Review next unreviewed game · ${unreviewedCount.toLocaleString()} left` : `All ${reviewableGames.length.toLocaleString()} reviewable games reviewed`}
          </button>
        </>}
      </form>
      {library.loading && (
        <div className="import-status" role="status">
          <div>
            <span>
              {progress?.archivesTotal
                ? `${progress.archivesCompleted} / ${progress.archivesTotal} months`
                : "Finding archives…"}
            </span>
            <button className="text-button" onClick={library.cancel}>
              <Square size={10} /> Stop
            </button>
          </div>
          <progress
            max={progress?.archivesTotal || 1}
            value={progress?.archivesCompleted || 0}
          />
          <span>
            {progress?.gamesLoaded.toLocaleString() ?? 0} games loaded
            {progress?.currentArchive ? ` · ${progress.currentArchive}` : ""}
          </span>
        </div>
      )}
      {library.error && (
        <p className="error-message" role="alert">
          {library.error}
        </p>
      )}
      {!library.loading && library.notice && (
        <p className="library-notice" role="status">
          {library.notice}
        </p>
      )}
      {library.games.length > 0 ? (
        <>
          <div className="library-filters">
            <div className="filter-row"><select aria-label="Game rules filter" value={rules} onChange={event => { setRules(event.target.value); setPage(0); }}>
              <option value="all">All rules · {library.games.length.toLocaleString()}</option>
              {ruleCounts.map(([value, count]) => <option key={value} value={value}>{rulesLabel(value)} · {count.toLocaleString()}</option>)}
            </select></div>
            <div className="search-input">
              <Search size={15} />
              <input
                aria-label="Search players"
                placeholder="Search players"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="filter-row">
              <select
                aria-label="Time control filter"
                value={timeClass}
                onChange={(e) => {
                  setTimeClass(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All controls</option>
                {[...new Set(library.games.map((g) => g.timeClass))].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
              <select
                aria-label="Result filter"
                value={result}
                onChange={(e) => {
                  setResult(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All results</option>
                <option value="win">Wins</option>
                <option value="loss">Losses</option>
                <option value="draw">Draws</option>
              </select>
            </div>
            <div className="filter-row">
              <input
                type="month"
                aria-label="Month filter"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(0);
                }}
              />
              <select
                aria-label="Sort games"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
          <div className="library-count">
            {filtered.length.toLocaleString()} games
            {library.username && <span>@{library.username}</span>}
          </div>
          <div className="game-list">
            {filtered
              .slice(currentPage * 30, currentPage * 30 + 30)
              .map((game) => {
                const isWhite =
                  game.white.username.toLowerCase() === library.username;
                const opponent = isWhite ? game.black : game.white;
                const me = isWhite ? game.white : game.black;
                const won = me.result === "win";
                const drawn = [
                  "agreed",
                  "repetition",
                  "stalemate",
                  "insufficient",
                  "50move",
                  "timevsinsufficient",
                ].includes(me.result);
                return (
                  <button
                    key={game.id}
                    className={`game-row ${game.id === selectedId ? "selected" : ""}`}
                    onClick={() => {
                      onSelect(game);
                      onClose();
                    }}
                  >
                    <span
                      className={`result-mark ${won ? "won" : drawn ? "drawn" : "lost"}`}
                    >
                      {won ? "1" : drawn ? "½" : "0"}
                    </span>
                    <span className="game-row-main">
                      <strong>
                        {opponent.username} <span>{opponent.rating || ""}</span>
                      </strong>
                      <span>
                        {isWhite ? "White" : "Black"} ·{" "}
                        {game.rules === "chess" ? game.timeClass : rulesLabel(game.rules)} ·{" "}
                        {formatTimeControl(game.timeControl)}
                      </span>
                    </span>
                    <time>
                      {new Date(game.endTime * 1000).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </time>
                  </button>
                );
              })}
            {filtered.length === 0 && (
              <p className="empty-list">No games match these filters.</p>
            )}
          </div>
          {pages > 1 && (
            <div className="pagination">
              <button
                className="icon-button"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Previous game page"
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <button
                className="icon-button"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Next game page"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </>
      ) : (
        !library.loading && (
          <div className="library-empty">
            <Search size={26} strokeWidth={1.4} />
            <h3>Bring your games.</h3>
            <p>
              Enter a username to import their complete public history, then
              choose a game to review.
            </p>
            <span>Your analysis stays in this browser.</span>
          </div>
        )
      )}
      <div className="library-footer">
        <span className="small-rook">♜</span>
        <span>
          Independent chess analysis
          <br />
          <span>Local engine analysis</span>
        </span>
      </div>
    </aside>
  );
}

export function formatTimeControl(control: string) {
  if (control === '-') return 'No clock data';
  if (control.includes("/")) return "Daily";
  const [base, increment] = control.split("+").map(Number);
  if (!Number.isFinite(base)) return control;
  return `${base / 60}${increment ? ` + ${increment}` : ""} min`;
}
