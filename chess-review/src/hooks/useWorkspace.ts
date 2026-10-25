import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DialogName } from "../components/Dialogs";
import { readSettings, type Settings } from "../lib/settings";
import { createPosition, moveFromUci } from "../lib/position";
import { demoGame } from "../lib/demo";
import { gameFromPgn, parseGame, type GameRecord } from "../lib/game";
import { saveReview, type SavedReview } from "../lib/storage";
import type { GameReview } from "../lib/review";
import { useLibrary } from "./useLibrary";
import { useReview } from "./useReview";
import { usePositionAnalysis } from "./usePositionAnalysis";
import { usePlayPosition } from "./usePlayPosition";
import { useExplanation } from "./useExplanation";
import { usePracticeReview } from "./usePracticeReview";
import { useThreatAnalysis } from "./useThreatAnalysis";
import type { PracticeColor } from "../lib/practice";
import { bestMoveArrow, continuationArrows, physicalMove } from "../lib/board-visuals";
import { browserThreadLimit } from '../engine/search-options'

type WorkspaceTab = "review" | "analysis" | "practice" | "history";
const lastGameKey = (username: string) => `open-file-last-game:${username}`

function readLastGame(username: string): string {
  try { return localStorage.getItem(lastGameKey(username)) ?? '' } catch { return '' }
}

function writeLastGame(username: string, gameId: string) {
  try { localStorage.setItem(lastGameKey(username), gameId) } catch {}
}

export function useWorkspace() {
  const library = useLibrary();
  const [game, setGame] = useState<GameRecord>(demoGame);
  const [transferredReview, setTransferredReview] = useState<SavedReview | null>(null);
  const [ply, setPly] = useState(18);
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [tab, setTab] = useState<WorkspaceTab>("review");
  const [dialog, setDialog] = useState<DialogName>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const play = usePlayPosition(settings.depth, settings.timeMs);
  const explanation = useExplanation({ autoplay: settings.autoplayExplanation, delayMs: settings.explanationDelayMs });
  const [playing, setPlaying] = useState(false);
  const [variation, setVariation] = useState<string[]>([]);
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [toast, setToast] = useState("");
  const audio = useRef<AudioContext | null>(null);
  const restoredUsername = useRef('')
  const parsed = useMemo(() => {
    try {
      return { ...parseGame(game), error: "" };
    } catch (e) {
      return { ...parseGame(demoGame), error: (e as Error).message };
    }
  }, [game]);
  const { review, progress, running, error, cacheNotice, start, cancel } =
    useReview(game, settings.depth, settings.timeMs, Math.min(settings.reviewThreads, browserThreadLimit()), transferredReview?.id === game.id ? transferredReview.review : undefined);
  const practice = usePracticeReview(review, settings.depth, settings.timeMs);
  const { practiceIndex, practiceColor, practiceStatus, hint, practiceFen, retryMoves, retry, practiceBusy, practiceFeedback } = practice;
  const variant = parsed.variant ?? 'chess';
  const safePly = Math.min(ply, parsed.moves.length);
  const currentMove = review?.moves[safePly - 1];
  const baseFen =
    tab === "practice" && retry ? retry.beforeFen : parsed.positions[safePly];
  const variationState = useMemo(() => {
    const board = createPosition(baseFen, variant);
    const sans: string[] = [];
    for (const uci of variation) {
      try {
        sans.push(moveFromUci(board, uci).san)
      } catch {
        break;
      }
    }
    return { fen: board.fen(), sans };
  }, [baseFen, variation, variant]);
  const fen =
    explanation.active ? explanation.fen : play.active ? play.fen : tab === "practice" ? (practiceFen ?? baseFen) : variationState.fen;
  const analysisHistory = useMemo(
    () => ({
      initialFen: parsed.initialFen,
      moves: [
        ...parsed.moves.slice(0, safePly).map((move) => move.uci),
        ...variation,
      ],
    }),
    [parsed.initialFen, parsed.moves, safePly, variation],
  );
  const { positionAnalysis, engineBusy, engineError, engineStopped, analysisThreads, stopAnalysis, restartAnalysis } = usePositionAnalysis({
    tab, engineEnabled: engineEnabled && !play.active && !explanation.active, running, fen, settings, parseError: parsed.error, analysisHistory, variant,
  });
  const threat = useThreatAnalysis({ fen, variant, enabled: tab === 'analysis' && engineEnabled && !play.active && !explanation.active && !running && !parsed.error, depth: settings.depth, timeMs: settings.timeMs });
  const displayEvaluation =
    tab === "practice" || play.active || explanation.active
      ? undefined
      : tab === "analysis" && positionAnalysis?.fen === fen
        ? positionAnalysis.evaluation
        : tab === "analysis" && variation.length > 0
          ? undefined
        : safePly
          ? currentMove?.evaluation
          : review?.initialAnalysis.evaluation;
  const isVariation = variation.length > 0;
  const lastMove = explanation.active ? explanation.lastMove : play.active ? play.lastMove ?? undefined : isVariation
    ? continuationArrows(baseFen, variation, variant, variation.length).at(-1)
    : parsed.moves[safePly - 1] ? physicalMove(parsed.moves[safePly - 1]) : undefined;
  const visualPv = explanation.active ? explanation.steps[explanation.currentStep + 1]?.uci ? [explanation.steps[explanation.currentStep + 1].uci!] : []
    : tab === 'analysis' ? positionAnalysis?.pv ?? [] : tab === 'review' ? review?.moves[safePly]?.pv ?? [] : [];
  const boardBestMove = bestMoveArrow(fen, visualPv[0], variant);
  const showBestArrow = !play.active && (settings.arrowMode === 'best' || settings.arrowMode === 'both');
  const boardCoachArrows = !play.active && (settings.arrowMode === 'coach' || settings.arrowMode === 'both') ? continuationArrows(fen, visualPv, variant) : [];
  const classificationMark = settings.showClassifications && currentMove && !isVariation && !play.active && (tab === 'review' && !explanation.active || explanation.active && explanation.steps[explanation.currentStep]?.stage === 'played')
    ? { square: currentMove.kingTo ?? currentMove.to, kind: currentMove.classification } : undefined;
  const opening =
    variant === 'threecheck' ? 'Three-check · three checks win' : variant === 'kingofthehill' ? 'King of the Hill · reach a center square' : variant === 'atomic' ? 'Atomic · captures explode nearby pieces' : variant === 'horde' ? 'Horde · defend the army or capture every piece' : variant === 'crazyhouse' ? 'Crazyhouse · captured pieces return as drops' : review?.opening?.name ||
    parsed.headers.Opening ||
    (parsed.headers.ECOUrl
      ? decodeURIComponent(parsed.headers.ECOUrl.split("/").pop()!).replaceAll(
          "-",
          " ",
        )
      : game.id === demoGame.id
        ? "Philidor Defense"
        : "Opening not identified");

  useEffect(() => {
    if (play.active) setOrientation(play.playerColor);
  }, [play.active, play.playerColor]);
  useEffect(() => { if (tab !== 'practice') practice.stop(); }, [tab, practice.stop]);
  useEffect(() => {
    try {
      localStorage.setItem("open-file-settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (!playing || tab === "practice" || play.active || explanation.active) return;
    const timer = setInterval(
      () =>
        setPly((value) => {
          if (value >= parsed.moves.length) {
            setPlaying(false);
            return value;
          }
          return value + 1;
        }),
      1100,
    );
    return () => clearInterval(timer);
  }, [playing, parsed.moves.length, tab, play.active, explanation.active]);

  const navigate = useCallback(
    (next: number) => {
      play.stop();
      explanation.stop();
      practice.stop();
      setPly(Math.max(0, Math.min(parsed.moves.length, next)));
      setVariation([]);
      setPlaying(false);
    },
    [parsed.moves.length, play.stop, explanation.stop, practice.stop],
  );
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        dialog ||
        event.ctrlKey || event.metaKey || event.altKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.closest(".review-board")
      )
        return;
      if (event.key === "f" || event.key === "F")
        setOrientation((value) => (value === "w" ? "b" : "w"));
      if (tab === "practice" || tab === "history" || play.active || explanation.active) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigate(safePly - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigate(safePly + 1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        navigate(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        navigate(parsed.moves.length);
      }
      if (event.code === "Space" && target.tagName !== "BUTTON") {
        event.preventDefault();
        setVariation([]);
        setPlaying((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, safePly, parsed.moves.length, navigate, tab, play.active, explanation.active]);



  function selectGame(selected: GameRecord) {
    play.stop();
    explanation.stop();
    practice.stop();
    setTransferredReview(null);
    setGame(selected);
    setPly(0);
    setVariation([]);
    setPlaying(false);
    setTab("review");
    if (library.username && library.games.some(candidate => candidate.id === selected.id)) writeLastGame(library.username, selected.id)
    setOrientation(
      selected.black.username.toLowerCase() === library.username ? "b" : "w",
    );
  }

  useEffect(() => {
    if (!library.username || !library.games.length) return
    if (restoredUsername.current === library.username) return
    restoredUsername.current = library.username
    const lastId = readLastGame(library.username)
    const selected = library.games.find(candidate => candidate.id === lastId || candidate.url === lastId) ?? library.games[0]
    if (selected && game.id !== selected.id) selectGame(selected)
  }, [game.id, library.games, library.username])

  function openSaved(entry: SavedReview) {
    try { selectGame({ ...gameFromPgn(entry.review.pgn), id: entry.id }); }
    catch { setToast('This saved game could not be read. Try reviewing the original game again.'); }
  }

  function importReport(report: GameReview) {
    const selected = gameFromPgn(report.pgn);
    selected.id = `report-${selected.id}-${report.analyzedAt}`;
    selectGame(selected);
    setTransferredReview({ id: selected.id, review: report });
    void saveReview(selected.id, report).catch(() => setToast('The imported review is open, but browser storage could not save it. Keep the review file to reopen it later.'));
  }

  function playSound() {
    if (!settings.sound) return;
    audio.current ??= new AudioContext();
    void audio.current.resume();
    const oscillator = audio.current.createOscillator();
    const gain = audio.current.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 420;
    gain.gain.setValueAtTime(0.06, audio.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.current.currentTime + 0.08,
    );
    oscillator.connect(gain).connect(audio.current.destination);
    oscillator.start();
    oscillator.stop(audio.current.currentTime + 0.08);
  }

  function boardMove(uci: string) {
    if (explanation.active) return;
    playSound();
    setPlaying(false);
    if (play.active) { play.move(uci); return; }
    if (tab === "practice" && retry) {
      void practice.attempt(uci);
      return;
    }
    setTab("analysis");
    setVariation((value) => [...value, uci]);
  }

  function beginPractice(color?: PracticeColor) {
    play.stop();
    explanation.stop();
    setTab("practice");
    practice.begin(undefined, color);
    setPlaying(false);
    setVariation([]);
  }

  function showLine(line: string[]) {
    if (!currentMove || !line.length) return;
    play.stop();
    explanation.stop();
    practice.stop();
    setPly(safePly - 1);
    setVariation(line);
    setTab("analysis");
    setPlaying(false);
  }

  function bestLine() {
    if (currentMove?.bestMove) showLine([currentMove.bestMove]);
  }

  function startPlay() {
    if (parsed.error) { setToast(parsed.error); return; }
    explanation.stop();
    setPlaying(false);
    play.start(fen, orientation, analysisHistory, variant);
  }

  function stopPlay() { play.stop(); }

  function explainCurrent() {
    if (!currentMove) return;
    play.stop();
    practice.stop();
    setPlaying(false);
    setVariation([]);
    explanation.start(currentMove);
  }

  function practicePosition(ply: number) {
    const move = review?.moves.find(candidate => candidate.ply === ply);
    if (!move || !move.bestMove) return;
    beginPractice();
    practice.begin(ply);
  }

  async function copyPosition() {
    try {
      await navigator.clipboard.writeText(fen);
      setToast("Position copied as FEN");
    } catch {
      setToast("Clipboard unavailable. Current FEN is shown in Analysis.");
    }
  }

  return {
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
    practice, variant,
    boardBestMove, showBestArrow, boardCoachArrows, classificationMark,
    threat,
  };
}
