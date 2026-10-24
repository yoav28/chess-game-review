import { useEffect, useState } from "react";
import { analyzePosition } from "../engine/stockfish";
import type { AnalysisOptions, PositionAnalysis } from "../engine/types";
import type { ChessVariant } from "../lib/position";

type PositionAnalysisOptions = {
  tab: string;
  engineEnabled: boolean;
  running: boolean;
  fen: string;
  settings: { depth: number; timeMs: number; analysisLines: number };
  parseError: string;
  analysisHistory: NonNullable<AnalysisOptions["history"]>;
  variant: ChessVariant;
};

export function usePositionAnalysis({
  tab, engineEnabled, running, fen, settings, parseError, analysisHistory, variant,
}: PositionAnalysisOptions) {
  const [positionAnalysis, setPositionAnalysis] =
    useState<PositionAnalysis | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  const [engineError, setEngineError] = useState("");

  useEffect(() => {
    if (tab !== "analysis" || !engineEnabled || running || parseError) {
      setEngineBusy(false);
      return;
    }
    const request = new AbortController();
    setEngineBusy(true);
    setEngineError("");
    setPositionAnalysis(null);
    const timer = setTimeout(() => {
      analyzePosition(fen, {
        depth: settings.depth,
        timeMs: Math.max(500, settings.timeMs),
        multiPv: settings.analysisLines,
        signal: request.signal,
        history: analysisHistory,
        variant,
      })
        .then((result) => {
          if (!request.signal.aborted) setPositionAnalysis(result);
        })
        .catch((e) => {
          if (!request.signal.aborted) setEngineError((e as Error).message);
        })
        .finally(() => {
          if (!request.signal.aborted) setEngineBusy(false);
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [
    tab,
    engineEnabled,
    running,
    fen,
    settings.depth,
    settings.timeMs,
    settings.analysisLines,
    parseError,
    analysisHistory,
    variant,
  ]);

  return { positionAnalysis, engineBusy, engineError };
}
