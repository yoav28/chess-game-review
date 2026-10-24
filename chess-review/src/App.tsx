import { Check, SlidersHorizontal } from "lucide-react";
import { AppHeader, AppFooter } from "./components/AppChrome";
import { BoardWorkspace } from "./components/BoardWorkspace";
import { GameLibrary } from "./components/GameLibrary";
import { ReviewPanel } from "./components/ReviewPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { PlayPositionPanel } from "./components/PlayPositionPanel";
import { PracticePanel } from "./components/PracticePanel";
import { Dialogs } from "./components/Dialogs";
import { demoGame } from "./lib/demo";
import { parseGame } from "./lib/game";
import { useWorkspace } from "./hooks/useWorkspace";

function App() {
  const {
    library, game, setPly, safePly,
    orientation, setOrientation, tab, setTab,
    dialog, setDialog, libraryOpen, setLibraryOpen,
    settings, setSettings, playing, setPlaying,
    variationState, setVariation, positionAnalysis, engineBusy,
    engineError, engineEnabled, setEngineEnabled, practiceIndex,
    setPracticeIndex, practiceColor, setPracticeColor, practiceStatus,
    setPracticeStatus, hint, setHint, setPracticeFen,
    toast, setToast, parsed, review,
    progress, running, error, cacheNotice,
    start, cancel, currentMove, retry,
    retryMoves, fen, displayEvaluation, isVariation,
    lastMove, opening, navigate, selectGame,
    boardMove, beginPractice, bestLine, copyPosition,
    play, startPlay, stopPlay,
  } = useWorkspace();

  return (
    <div className="app-shell">
      <AppHeader onImport={() => setDialog("import")} onSettings={() => setDialog("settings")} />
      <div className="workspace">
        <div className={`library-wrapper ${libraryOpen ? "open" : ""}`}>
          <GameLibrary
            library={library}
            selectedId={game.id}
            onSelect={selectGame}
            onClose={() => setLibraryOpen(false)}
          />
        </div>
        {libraryOpen && (
          <button
            className="library-scrim"
            onClick={() => setLibraryOpen(false)}
            aria-label="Close library overlay"
          />
        )}
        <BoardWorkspace
          game={game}
          parsed={parsed}
          review={review}
          ply={safePly}
          orientation={orientation}
          practice={tab === "practice" || play.active}
          opening={opening}
          fen={fen}
          lastMove={tab !== "practice" ? lastMove : undefined}
          bestMove={
            tab === "practice"
              ? practiceStatus === "revealed"
                ? (retry?.bestMove ?? undefined)
                : undefined
              : tab === "analysis" && !play.active
                ? (positionAnalysis?.bestMove ?? undefined)
                : undefined
          }
          showBestMove={
            settings.showArrows && !play.active &&
            (tab !== "practice" || practiceStatus === "revealed")
          }
          disabled={
            (tab === "practice" && ["solved", "revealed"].includes(practiceStatus)) ||
            (play.active && (play.thinking || Boolean(play.outcome) || play.turn !== play.playerColor))
          }
          evaluation={displayEvaluation}
          playing={playing}
          isVariation={isVariation}
          variationSans={variationState.sans}
          onOpenLibrary={() => setLibraryOpen(true)}
          onMove={boardMove}
          onFlip={() => setOrientation((value) => (value === "w" ? "b" : "w"))}
          onCopyPosition={copyPosition}
          onNavigate={navigate}
          onAutoplay={() => {
            setVariation([]);
            if (safePly === parsed.moves.length) setPly(0);
            setPlaying((value) => !value);
          }}
          onUndoVariation={() => setVariation((value) => value.slice(0, -1))}
          onReturnToGame={() => setVariation([])}
          onSelectMove={(next) => {
            if (tab === "practice") setTab("review");
            navigate(next);
          }}
        />
        <aside className="inspector">
          <div
            className="inspector-tabs"
            role="tablist"
            aria-label="Review workspace"
          >
            {(["review", "analysis", "practice"] as const).map((value) => (
              <button
                role="tab"
                aria-selected={tab === value}
                key={value}
                onClick={() => {
                  stopPlay();
                  if (value === "practice") beginPractice();
                  else {
                    setTab(value);
                    setVariation([]);
                    setPlaying(false);
                  }
                }}
              >
                {value === "review"
                  ? "Review"
                  : value === "analysis"
                    ? "Analysis"
                    : "Practice"}
              </button>
            ))}
          </div>
          <div className="inspector-body">
            {tab === "review" ? (
              <ReviewPanel
                game={game}
                review={review}
                move={currentMove}
                running={running}
                progress={progress}
                error={error}
                onStart={start}
                onCancel={cancel}
                onSelect={navigate}
                onPractice={beginPractice}
                onBestLine={bestLine}
                onMethod={() => setDialog("method")}
              />
            ) : tab === "analysis" && play.active ? (
              <PlayPositionPanel play={play} onExit={stopPlay} />
            ) : tab === "analysis" ? (
              <AnalysisPanel
                analysis={positionAnalysis}
                busy={engineBusy}
                error={engineError}
                enabled={engineEnabled}
                onToggle={() => setEngineEnabled((value) => !value)}
                onLine={(moves) => {
                  setVariation((value) => [...value, ...moves]);
                  setPlaying(false);
                }}
                variation={variationState.sans}
                onBack={() => setVariation([])}
                fen={fen}
                games={library.games}
                onExploreMove={boardMove}
                onPlay={startPlay}
              />
            ) : (
              <>
                <div className="practice-filter">
                  <label htmlFor="practice-color">Practice</label>
                  <select
                    id="practice-color"
                    value={practiceColor}
                    onChange={(e) => {
                      setPracticeColor(e.target.value);
                      setPracticeIndex(0);
                      setPracticeFen(null);
                      setHint(false);
                      setPracticeStatus("thinking");
                    }}
                  >
                    <option value="all">Both players</option>
                    <option value="w">White’s moves</option>
                    <option value="b">Black’s moves</option>
                  </select>
                </div>
                <PracticePanel
                  moves={retryMoves}
                  index={practiceIndex}
                  status={practiceStatus}
                  hint={hint}
                  onHint={() => setHint(true)}
                  onSolution={() => {
                    setPracticeStatus("revealed");
                    setPracticeFen(null);
                  }}
                  onNext={() => {
                    if (practiceIndex + 1 >= retryMoves.length) {
                      setTab("review");
                      setToast(
                        "Practice complete. Review another game to keep learning.",
                      );
                    } else setPracticeIndex((value) => value + 1);
                    setPracticeFen(null);
                    setHint(false);
                    setPracticeStatus("thinking");
                  }}
                  onExit={() => setTab("review")}
                />
              </>
            )}
            {cacheNotice && <p className="library-notice">{cacheNotice}</p>}
          </div>
          <div className="inspector-bottom">
            <button
              className="text-button"
              onClick={() => setDialog("settings")}
            >
              <SlidersHorizontal size={14} />
              Depth {settings.depth} · {settings.timeMs / 1000}s / position
            </button>
            <button className="text-button" onClick={() => setDialog("method")}>
              About
            </button>
          </div>
        </aside>
      </div>
      <AppFooter onSample={() => { selectGame(demoGame); setPly(18); }} />
      <Dialogs
        dialog={dialog}
        onClose={() => setDialog(null)}
        settings={settings}
        onSettings={setSettings}
        onImport={(selected) => {
          selectGame(selected);
          if (!parseGame(selected).moves.length) setTab("analysis");
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
