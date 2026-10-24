import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useHotkeys } from 'react-hotkeys-hook';
import { useShallow } from 'zustand/react/shallow';

import useReviewPlayback from '../../hooks/useReviewPlayback';
import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';
import NavigationIcon from '../NavigationIcon';
import Settings from './Settings';

export default function GameNav() {
  const { isPlaying, togglePlayback, pausePlayback } = useReviewPlayback();

  const {
    currentGame,
    currentMoveNum,
    isFlipped,
    flipBoard,
    toFirstMove,
    toPrevMove,
    toNextMove,
    toFinalMove,
    reset,
  } = useBoardStore(
    useShallow(state => ({
      currentGame: state.currentGame,
      currentMoveNum: state.currentMoveNum,
      isFlipped: state.isFlipped,
      flipBoard: state.flipBoard,
      toFirstMove: state.toFirstMove,
      toPrevMove: state.toPrevMove,
      toNextMove: state.toNextMove,
      toFinalMove: state.toFinalMove,
      reset: state.reset,
    })),
  );

  const resetSelectGameStore = useSelectGameStore(state => state.reset);
  const stage = useStageStore(state => state.stage);
  const setStage = useStageStore(state => state.setStage);

  const reviewFinished = useStageStore(
    state => state.computed.reviewFinished,
  );

  const history = currentGame.history({ verbose: true });

  useHotkeys('right', () => {
    pausePlayback();

    if (
      history.length === 0
      || currentMoveNum === history.length
      || !reviewFinished
    ) {
      return;
    }

    toNextMove();

    if (stage === 'review-overview' && currentMoveNum === 0) {
      setStage('review-moves');
    }
  });

  useHotkeys('left', () => {
    pausePlayback();
    if (history.length === 0 || currentMoveNum === 0 || !reviewFinished)
      return;
    toPrevMove();
  });

  useHotkeys('up', () => {
    pausePlayback();
    if (history.length === 0 || currentMoveNum === 0 || !reviewFinished)
      return;
    toFirstMove();
  });

  useHotkeys('down', () => {
    pausePlayback();

    if (
      history.length === 0
      || currentMoveNum === history.length
      || !reviewFinished
    ) {
      return;
    }

    toFinalMove();

    if (stage === 'review-overview' && currentMoveNum === 0) {
      setStage('review-moves');
    }
  });

  useHotkeys('x', () => flipBoard());

  return (
    <div
      className="review-navigation"
      id="GameNav"
    >
      <div className="review-navigation-moves">
        <Button
          aria-label="First move"
          className="grow text-3xl"
          isDisabled={
            history.length === 0 || currentMoveNum === 0 || !reviewFinished
          }
          isIconOnly
          onPress={() => {
            pausePlayback();
            toFirstMove();
          }}
          radius="sm"
          size="md"
        >
          <NavigationIcon name="first" />
        </Button>
        <Button
          aria-label="Previous move"
          className="grow text-3xl"
          isDisabled={
            history.length === 0 || currentMoveNum === 0 || !reviewFinished
          }
          isIconOnly
          onPress={() => {
            pausePlayback();
            toPrevMove();
          }}
          radius="sm"
          size="md"
        >
          <NavigationIcon name="previous" />
        </Button>
        <Button
          aria-label={isPlaying ? 'Pause review' : 'Play review'}
          className="grow text-3xl"
          isDisabled={!reviewFinished || history.length === 0}
          isIconOnly
          onPress={togglePlayback}
          radius="sm"
          size="md"
        >
          <Icon icon={isPlaying ? 'material-symbols:pause-rounded' : 'material-symbols:play-arrow-rounded'} />
        </Button>
        <Button
          aria-label="Next move"
          className="grow text-3xl"
          isDisabled={
            history.length === 0
            || currentMoveNum === history.length
            || !reviewFinished
          }
          isIconOnly
          onPress={() => {
            pausePlayback();
            toNextMove();

            if (stage === 'review-overview' && currentMoveNum === 0) {
              setStage('review-moves');
            }
          }}
          radius="sm"
          size="md"
        >
          <NavigationIcon name="next" />
        </Button>
        <Button
          aria-label="Final move"
          className="grow text-3xl"
          isDisabled={
            history.length === 0
            || currentMoveNum === history.length
            || !reviewFinished
          }
          isIconOnly
          onPress={() => {
            pausePlayback();
            toFinalMove();

            if (stage === 'review-overview' && currentMoveNum === 0) {
              setStage('review-moves');
            }
          }}
          radius="sm"
          size="md"
        >
          <NavigationIcon name="last" />
        </Button>
      </div>
      <div className="review-navigation-actions" id="minor-buttons">
        <Button
          aria-label="Flip board"
          className="text-2xl"
          isIconOnly
          onPress={() => flipBoard()}
          radius="sm"
          size="sm"
          variant="flat"
        >
          <Icon
            className="transition-transform"
            icon="material-symbols:sync"
            style={{
              transform: `rotate(${isFlipped ? '180deg' : '0'})`,
            }}
          />
        </Button>
        <Button
          onPress={() => {
            reset();
            resetSelectGameStore();
            setStage('home');
          }}
          size="sm"
          variant="flat"
        >
          <Icon icon="material-symbols:add-box-outline-rounded" />
          New
        </Button>
        <Settings />
      </div>
    </div>
  );
}
