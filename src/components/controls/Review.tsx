import { Button, Progress } from '@heroui/react';
import { DEFAULT_POSITION } from 'chess.js';
import { useEffect, useState } from 'react';

import { createAnalysisEngine } from '../../services/analysis';
import { useBatchStore } from '../../stores/useBatchStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useStageStore } from '../../stores/useStageStore';
import { useStockfishOutputStore } from '../../stores/useStockfishOutputStore';
import ReviewMoves from './ReviewMoves';
import ReviewOverview from './ReviewOverview';

import type { MoveEval } from '../../stores/useStockfishOutputStore';

export default function Review() {
  const gameVersion = useBoardStore(state => state.randomState);
  const stage = useStageStore(state => state.stage);
  const setStage = useStageStore(state => state.setStage);
  const review = useStockfishOutputStore(state => state.review);
  const { analysisDepth, analysisModel } = useSettingsStore(state => state.settings);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (stage !== 'reviewing')
      return;
    const controller = new AbortController();
    const currentGame = useBoardStore.getState().currentGame;
    const history = currentGame.history({ verbose: true });
    const fens = [history[0]?.before ?? currentGame.header().FEN ?? DEFAULT_POSITION, ...history.map(move => move.after)];
    const terminal = currentGame.isCheckmate() || currentGame.isStalemate();
    const positions = terminal ? fens.slice(0, -1) : fens;
    setError('');
    setProgress(0);
    setIsLoading(true);
    useEvalStore.getState().reset();
    useStockfishOutputStore.getState().reset();

    async function run() {
      let engine: Awaited<ReturnType<typeof createAnalysisEngine>> | undefined;

      try {
        engine = await createAnalysisEngine({ depth: analysisDepth, model: analysisModel, signal: controller.signal });
        setIsLoading(false);
        const best3Moves: MoveEval[][] = [];

        for (let i = 0; i < positions.length; i++) {
          best3Moves.push(await engine.analyze(positions[i]));
          if (controller.signal.aborted)
            return;
          setProgress(Math.round(((i + 1) / positions.length) * 100));
        }

        useStockfishOutputStore.setState({ best3Moves, fenIndex: positions.length - 1, isListening: false });
        useEvalStore.getState().populate();
        setStage('review-overview');
      }
      catch (cause) {
        if (!controller.signal.aborted) {
          const message = cause instanceof Error ? cause.message : 'Analysis failed. Please try again.';
          setError(message);
          if (useBatchStore.getState().active)
            useBatchStore.getState().fail(message);
          setStage('loaded');
        }
      }
      finally {
        engine?.dispose();
        if (!controller.signal.aborted)
          setIsLoading(false);
      }
    }

    void run();

    return () => controller.abort();
  }, [stage, gameVersion, setStage]);

  return (
    <div className="h-full" id="Review">
      {error && <p className="mb-3 text-small text-danger" role="alert">{error}</p>}
      {stage === 'loaded'
        ? (
            <Button
              className="h-12 text-medium font-bold text-shadow-xs"
              color="primary"
              fullWidth
              onPress={review}
              radius="sm"
            >
              Generate Review
            </Button>
          )
        : stage === 'reviewing'
          ? (
              <div className="flex flex-col gap-3">
                <p className="text-small text-foreground-500">{isLoading ? 'Loading Stockfish…' : `Analyzing with Stockfish ${analysisModel === 'nnue' ? 'NNUE' : 'Classical'} at depth ${analysisDepth}`}</p>
                <Progress aria-label="Review progress" showValueLabel size="lg" value={progress} />
                <Button
                  onPress={() => {
                    useBatchStore.getState().cancel();
                    setStage('loaded');
                  }}
                  radius="sm"
                  size="sm"
                  variant="flat"
                >
                  Cancel analysis
                </Button>
              </div>
            )
          : stage === 'review-overview'
            ? <ReviewOverview />
            : stage === 'review-moves'
              ? <ReviewMoves />
              : null}
    </div>
  );
}
