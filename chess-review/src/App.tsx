import { ArrowLeftRight, Check, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play, Search, Settings, SlidersHorizontal, SquarePlus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { AppHeader } from "./components/AppChrome";
import { BoardWorkspace } from "./components/BoardWorkspace";
import { GameLibrary } from "./components/GameLibrary";
import { ReviewPanel } from "./components/ReviewPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { PlayPositionPanel } from "./components/PlayPositionPanel";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { SavedReviewsPanel } from "./components/SavedReviewsPanel";
import { ReviewShare } from "./components/ReviewShare";
import { WorkspaceTabs, type WorkspaceTab } from "./components/WorkspaceTabs";
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
    boardMove, beginPractice, bestLine, showLine, copyPosition,
    play, startPlay, stopPlay,
    explanation, explainCurrent, practicePosition,
    openSaved, importReport,
    practice, variant, boardBestMove, showBestArrow, boardCoachArrows, classificationMark, threat,
  } = useWorkspace();
  const [reviewMode, setReviewMode] = useState<'overview' | 'moves'>('overview');
  const reviewReportActive = tab === 'review' && Boolean(review);
  const guidedReviewActive = reviewReportActive && reviewMode === 'moves';
  const boardNavigationActive = guidedReviewActive || (tab === 'analysis' && !play.active);
  const favoriteKey = `review-favorite:${game.id}`;
  const [reviewFavorite, setReviewFavorite] = useState(() => readReviewFavorite(favoriteKey));

  useEffect(() => {
    setReviewMode('overview');
    setReviewFavorite(readReviewFavorite(favoriteKey));
  }, [favoriteKey]);

  useEffect(() => {
    if (review) setReviewMode('moves');
  }, [review]);

  const changeWorkspaceTab = (value: WorkspaceTab) => {
    stopPlay();
    explanation.stop();
    practice.stop();
    if (value !== 'review') setReviewMode('overview');
    if (value === "practice") beginPractice();
    else {
      setTab(value);
      setVariation([]);
      setPlaying(false);
    }
  };

  const togglePlayback = () => {
    setVariation([]);
    if (safePly === parsed.moves.length) setPly(0);
    setPlaying(value => !value);
  };

  return (
    <BoardAppearanceContext.Provider value={{ appearance: settings, onChange: patch => setSettings(normalizeSettings({ ...settings, ...patch })) }}>
    <div className="app-shell">
      <AppHeader
        username={library.username}
        onImport={() => setDialog("import")}
        onLibrary={() => setLibraryOpen(value => !value)}
        onSettings={() => setDialog("settings")}
      />
      <div className="workspace">
        <div className={`library-wrapper ${libraryOpen ? "open" : ""}`}>
          <GameLibrary
            library={library}
            selectedId={game.id}
            reviewedGameId={review?.pgn === game.pgn ? game.id : undefined}
            onSelect={selected => { selectGame(selected); setLibraryOpen(false); }}
            onClose={() => setLibraryOpen(false)}
            onSample={() => { selectGame(demoGame); setPly(0); setLibraryOpen(false); }}
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
          showMoves={tab !== "review"}
          showTimeline={tab !== "review"}
          showBoardToolbar={!boardNavigationActive}
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
          onAutoplay={togglePlayback}
          onUndoVariation={() => setVariation((value) => value.slice(0, -1))}
          onReturnToGame={() => setVariation([])}
          onSelectMove={(next) => {
            if (tab === "practice") setTab("review");
            navigate(next);
          }}
        />
        <button className="board-settings" onClick={() => setDialog("settings")} aria-label="Board settings">
          <Settings size={18} />
        </button>
        <aside className={`inspector ${reviewReportActive ? 'review-report-active' : ''} ${guidedReviewActive ? 'review-step-active' : ''}`}>
          <div className="inspector-header">
            {reviewReportActive && <>
              <button className="inspector-back" aria-label={guidedReviewActive ? 'Back to highlights' : 'Open game library'} onClick={() => guidedReviewActive ? setReviewMode('overview') : setLibraryOpen(true)}><ChevronLeft size={23} /></button>
              <button className="inspector-favorite" aria-label="Favorite review" aria-pressed={reviewFavorite} onClick={() => {
                const value = !reviewFavorite;
                setReviewFavorite(value);
                try { localStorage.setItem(favoriteKey, String(value)); } catch { }
              }}><Star size={20} fill={reviewFavorite ? 'currentColor' : 'none'} /></button>
            </>}
            <h1 id={reviewReportActive ? 'review-panel-title' : undefined}>{tab === "review" ? "Game Review" : tab === "history" ? "Saved Games" : tab === "analysis" ? "Analysis" : "Practice"}</h1>
            {reviewReportActive && <button className="inspector-analysis" aria-label="Analysis" onClick={() => changeWorkspaceTab('analysis')}><Search size={19} /></button>}
          </div>
          {!reviewReportActive && <WorkspaceTabs tab={tab} onChange={changeWorkspaceTab} analysisPresentation={tab === 'analysis'} />}
          <div className="inspector-body" role={reviewReportActive ? 'region' : 'tabpanel'} id={reviewReportActive ? 'review-panel-body' : 'workspace-panel'} aria-labelledby={reviewReportActive ? 'review-panel-title' : `workspace-tab-${tab}`}>
            {explanation.active ? (
              <ExplanationPanel explanation={explanation} onExit={explanation.stop} />
            ) : tab === "review" ? (
              <ReviewPanel
                key={game.id}
                game={game}
                parsed={parsed}
                ply={safePly}
                showTimeSpent={settings.showTimeSpent}
                moveReview={reviewMode === 'moves'}
                onMoveReview={setReviewMode}
                games={library.games}
                username={library.username}
                review={review}
                move={currentMove}
                running={running}
                progress={progress}
                error={error}
                onStart={start}
                onCancel={cancel}
                onSelect={navigate}
                onExploreOpening={ply => { setPly(ply); setVariation([]); setPlaying(false); setTab("analysis"); }}
                onPractice={beginPractice}
                onPracticePosition={practicePosition}
                onExplain={explainCurrent}
                preferredColor={game.white.username.toLowerCase() === library.username ? 'w' : game.black.username.toLowerCase() === library.username ? 'b' : undefined}
                onBestLine={bestLine}
                onShowLine={showLine}
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
                game={game}
                parsed={parsed}
                review={review}
                ply={safePly}
                opening={opening}
                showTimeSpent={settings.showTimeSpent}
                onSelect={navigate}
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
          {reviewReportActive && !guidedReviewActive && <div className="review-overview-footer">
            <button className="primary full-width review-start-button" onClick={() => setReviewMode('moves')}>
              Start Review <ChevronRight size={22} />
            </button>
          </div>}
          {boardNavigationActive ? (
            <div className="review-navigation">
              <div className="review-navigation-moves">
                <button aria-label="First move" disabled={safePly === 0} onClick={() => navigate(0)}><ChevronFirst size={22} /></button>
                <button aria-label="Previous move" disabled={safePly === 0} onClick={() => navigate(safePly - 1)}><ChevronLeft size={22} /></button>
                <button aria-label={playing ? 'Pause review' : 'Play review'} onClick={togglePlayback}>{playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}</button>
                <button aria-label="Next move" disabled={safePly >= parsed.moves.length} onClick={() => navigate(safePly + 1)}><ChevronRight size={22} /></button>
                <button aria-label="Final move" disabled={safePly >= parsed.moves.length} onClick={() => navigate(parsed.moves.length)}><ChevronLast size={22} /></button>
              </div>
              <div className="review-navigation-actions">
                <button aria-label="Flip board" onClick={() => setOrientation(value => value === 'w' ? 'b' : 'w')}><ArrowLeftRight size={18} /></button>
                <button aria-label="Open game library" onClick={() => setLibraryOpen(true)}><SquarePlus size={17} /> New</button>
                <button aria-label="Review settings" onClick={() => setDialog('settings')}><Settings size={18} /></button>
              </div>
            </div>
          ) : !reviewReportActive ? <div className="inspector-bottom">
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
          </div> : null}
        </aside>
      </div>
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

function readReviewFavorite(key: string) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
