import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { DialogName, Settings } from "../components/Dialogs";
import { demoGame } from "../lib/demo";
import { parseGame, type GameRecord } from "../lib/game";
import { useLibrary } from "./useLibrary";
import { useReview } from "./useReview";
import { usePositionAnalysis } from "./usePositionAnalysis";
import { usePlayPosition } from "./usePlayPosition";

type WorkspaceTab = "review" | "analysis" | "practice";
const defaultSettings: Settings = {
  depth: 16,
  timeMs: 500,
  showArrows: true,
  sound: false,
};

function initialSettings(): Settings {
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem("open-file-settings") || "{}"),
    };
  } catch {
    return defaultSettings;
  }
}

export function useWorkspace() {
  const library = useLibrary();
  const [game, setGame] = useState<GameRecord>(demoGame);
  const [ply, setPly] = useState(18);
  const [orientation, setOrientation] = useState<"w" | "b">("w");
  const [tab, setTab] = useState<WorkspaceTab>("review");
  const [dialog, setDialog] = useState<DialogName>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const play = usePlayPosition(settings.depth, settings.timeMs);
  const [playing, setPlaying] = useState(false);
  const [variation, setVariation] = useState<string[]>([]);
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceColor, setPracticeColor] = useState("all");
  const [practiceStatus, setPracticeStatus] = useState<
    "thinking" | "wrong" | "solved" | "revealed"
  >("thinking");
  const [hint, setHint] = useState(false);
  const [practiceFen, setPracticeFen] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const audio = useRef<AudioContext | null>(null);
  const parsed = useMemo(() => {
    try {
      return { ...parseGame(game), error: "" };
    } catch (e) {
      return { ...parseGame(demoGame), error: (e as Error).message };
    }
  }, [game]);
  const { review, progress, running, error, cacheNotice, start, cancel } =
    useReview(game, settings.depth, settings.timeMs);
  const safePly = Math.min(ply, parsed.moves.length);
  const currentMove = review?.moves[safePly - 1];
  const retryMoves = useMemo(
    () =>
      review?.moves.filter(
        (move) =>
          ["inaccuracy", "mistake", "blunder", "missed"].includes(
            move.classification,
          ) &&
          (practiceColor === "all" || move.color === practiceColor) &&
          move.bestMove,
      ) ?? [],
    [review, practiceColor],
  );
  const retry = retryMoves[practiceIndex];
  const baseFen =
    tab === "practice" && retry ? retry.beforeFen : parsed.positions[safePly];
  const variationState = useMemo(() => {
    const board = new Chess(baseFen);
    const sans: string[] = [];
    for (const uci of variation) {
      try {
        sans.push(
          board.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci[4],
          }).san,
        );
      } catch {
        break;
      }
    }
    return { fen: board.fen(), sans };
  }, [baseFen, variation]);
  const fen =
    play.active ? play.fen : tab === "practice" ? (practiceFen ?? baseFen) : variationState.fen;
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
  const { positionAnalysis, engineBusy, engineError } = usePositionAnalysis({
    tab, engineEnabled: engineEnabled && !play.active, running, fen, settings, parseError: parsed.error, analysisHistory,
  });
  const displayEvaluation =
    tab === "practice" || play.active
      ? undefined
      : tab === "analysis" && positionAnalysis?.fen === fen
        ? positionAnalysis.evaluation
        : safePly
          ? currentMove?.evaluation
          : review?.initialAnalysis.evaluation;
  const isVariation = variation.length > 0;
  const lastMove = play.active ? play.lastMove ?? undefined : isVariation
    ? { from: variation.at(-1)!.slice(0, 2), to: variation.at(-1)!.slice(2, 4) }
    : parsed.moves[safePly - 1];
  const opening =
    review?.opening?.name ||
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
    if (!playing || tab === "practice" || play.active) return;
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
  }, [playing, parsed.moves.length, tab, play.active]);

  const navigate = useCallback(
    (next: number) => {
      play.stop();
      setPly(Math.max(0, Math.min(parsed.moves.length, next)));
      setVariation([]);
      setPlaying(false);
    },
    [parsed.moves.length, play.stop],
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
      if (tab === "practice" || play.active) return;
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
  }, [dialog, safePly, parsed.moves.length, navigate, tab, play.active]);



  function selectGame(selected: GameRecord) {
    play.stop();
    setGame(selected);
    setPly(0);
    setVariation([]);
    setPlaying(false);
    setPracticeFen(null);
    setPracticeIndex(0);
    setTab("review");
    setOrientation(
      selected.black.username.toLowerCase() === library.username ? "b" : "w",
    );
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
    playSound();
    setPlaying(false);
    if (play.active) { play.move(uci); return; }
    if (tab === "practice" && retry) {
      if (practiceStatus === "solved" || practiceStatus === "revealed") return;
      if (uci === retry.bestMove) {
        const board = new Chess(retry.beforeFen);
        board.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4],
        });
        setPracticeFen(board.fen());
        setPracticeStatus("solved");
      } else setPracticeStatus("wrong");
      return;
    }
    setTab("analysis");
    setVariation((value) => [...value, uci]);
  }

  function beginPractice() {
    play.stop();
    setTab("practice");
    setPracticeIndex(0);
    setPracticeStatus("thinking");
    setPracticeFen(null);
    setHint(false);
    setPlaying(false);
    setVariation([]);
  }

  function bestLine() {
    if (!currentMove?.bestMove) return;
    setPly(safePly - 1);
    setVariation([currentMove.bestMove]);
    setTab("analysis");
    setPlaying(false);
  }

  function startPlay() {
    if (parsed.error) { setToast(parsed.error); return; }
    setPlaying(false);
    play.start(fen, orientation, analysisHistory);
  }

  function stopPlay() { play.stop(); }

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
  };
}
