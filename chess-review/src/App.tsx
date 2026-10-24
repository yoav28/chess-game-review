import { Check, SlidersHorizontal } from "lucide-react";
import { AppHeader, AppFooter } from "./components/AppChrome";
import { BoardWorkspace } from "./components/BoardWorkspace";
import { GameLibrary } from "./components/GameLibrary";
import { ReviewPanel } from "./components/ReviewPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { PlayPositionPanel } from "./components/PlayPositionPanel";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { SavedReviewsPanel } from "./components/SavedReviewsPanel";
import { ReviewShare } from "./components/ReviewShare";
import { WorkspaceTabs } from "./components/WorkspaceTabs";
import { PracticePanel } from "./components/PracticePanel";
import { Dialogs } from "./components/Dialogs";
import { demoGame } from "./lib/demo";
import { parseGame } from "./lib/game";
import { useWorkspace } from "./hooks/useWorkspace";
import { BoardAppearanceContext } from "./components/BoardAppearanceContext";
import { normalizeSettings } from "./lib/settings";

function App() {
  const {
    library, game, setPly, safePly,
    orientation, setOrientation, tab, setTab,
    dialog, setDialog, libraryOpen, setLibraryOpen,
    settings, setSettings, playing, setPlaying,
    variationState, setVariation, positionAnalysis, engineBusy,
    engineError, engineEnabled, setEngineEnabled, engineStopped, analysisThreads, stopAnalysis, restartAnalysis, practiceIndex,
    practiceColor, practiceStatus, hint, practiceBusy, practiceFeedback,
    toast, setToast, parsed, review,
    progress, running, error, cacheNotice,
    start, cancel, currentMove, retry,
    retryMoves, fen, displayEvaluation, isVariation,
    lastMove, opening, navigate, selectGame,
    boardMove, beginPractice, bestLine, copyPosition,
    play, startPlay, stopPlay,
    explanation, explainCurrent, practicePosition,
    openSaved, importReport,
    practice, variant, boardBestMove, showBestArrow, boardCoachArrows, classificationMark, threat,
  } = useWorkspace();

  return (
    <BoardAppearanceContext.Provider value={{ appearance: settings, onChange: patch => setSettings(normalizeSettings({ ...settings, ...patch })) }}>
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
          practice={tab === "practice" || play.active || explanation.active}
          opening={opening}
          fen={fen}
          lastMove={tab !== "practice" ? lastMove : undefined}
          bestMove={boardBestMove}
          showBestMove={showBestArrow}
          coachArrows={boardCoachArrows}
          threatArrow={threat.result?.arrow ?? undefined}
          classification={classificationMark}
          showTimeSpent={settings.showTimeSpent}
          disabled={
            explanation.active || (tab === "practice" && (practiceBusy || ["solved", "revealed"].includes(practiceStatus))) ||
            (play.active && (play.thinking || Boolean(play.outcome) || play.turn !== play.playerColor))
          }
          evaluation={displayEvaluation}
          playing={playing}
          isVariation={isVariation && !explanation.active}
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
          <WorkspaceTabs tab={tab} onChange={value => {
                  stopPlay();
                  explanation.stop();
                  practice.stop();
                  if (value === "practice") beginPractice();
                  else {
                    setTab(value);
                    setVariation([]);
                    setPlaying(false);
                  }
                }} />
          <div className="inspector-body" role="tabpanel" id="workspace-panel" aria-labelledby={`workspace-tab-${tab}`}>
            {explanation.active ? (
              <ExplanationPanel explanation={explanation} onExit={explanation.stop} />
            ) : tab === "review" ? (
              <ReviewPanel
                key={game.id}
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
                onPracticePosition={practicePosition}
                onExplain={explainCurrent}
                preferredColor={game.white.username.toLowerCase() === library.username ? 'w' : game.black.username.toLowerCase() === library.username ? 'b' : undefined}
                onBestLine={bestLine}
                onMethod={() => setDialog("method")}
                onImportReport={importReport}
                orientation={orientation}
                settings={settings}
                onSettings={setSettings}
              />
            ) : tab === "history" ? (
              <><ReviewShare review={review} onImport={importReport} /><SavedReviewsPanel onOpen={openSaved} refreshKey={review?.analyzedAt} /></>
            ) : tab === "analysis" && play.active ? (
              <PlayPositionPanel play={play} onExit={stopPlay} />
            ) : tab === "analysis" ? (
              <AnalysisPanel
                analysis={positionAnalysis}
                busy={engineBusy}
                error={engineError}
                enabled={engineEnabled}
                onToggle={() => setEngineEnabled((value) => !value)}
                settings={settings}
                onSettings={setSettings}
                stopped={engineStopped}
                threads={analysisThreads}
                onStop={() => { stopAnalysis(); threat.stop(); }}
                onRun={() => { setEngineEnabled(true); restartAnalysis(); }}
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
                variant={variant}
                threat={threat}
              />
            ) : (
              <>
                <div className="practice-filter">
                  <label htmlFor="practice-color">Practice</label>
                  <select
                    id="practice-color"
                    value={practiceColor}
                    onChange={(e) => practice.setColor(e.target.value as 'all' | 'w' | 'b')}
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
                  busy={practiceBusy}
                  feedback={practiceFeedback}
                  onHint={practice.showHint}
                  onSolution={practice.showSolution}
                  onNext={() => {
                    if (practice.next()) {
                      setTab("review");
                      setToast(
                        "Practice complete. Review another game to keep learning.",
                      );
                    }
                  }}
                  onExit={() => { practice.stop(); setTab("review"); }}
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
        accuracyModel={review?.accuracyModel}
        accuracyVersion={review?.accuracyVersion}
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
    </BoardAppearanceContext.Provider>
  );
}

export default App;
