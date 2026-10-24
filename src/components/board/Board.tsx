import { useEffect } from 'react';
import { mountStoreDevtool } from 'simple-zustand-devtools';
import { useShallow } from 'zustand/react/shallow';

import useBoardInteraction from '../../hooks/useBoardInteraction';
import useSoundFx from '../../hooks/useSoundFx';
import { useBoardStore } from '../../stores/useBoardStore';
import { useEvalStore } from '../../stores/useEvalStore';
import { useManualHighlightStore } from '../../stores/useManualHighlightStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useStageStore } from '../../stores/useStageStore';
import { useStockfishOutputStore } from '../../stores/useStockfishOutputStore';
import { useVariationStore } from '../../stores/useVariationStore';
import Arrows from './Arrows';
import Coors from './Coors';
import EndgameBadges from './EndgameBadges';
import EvalBar from './EvalBar';
import Highlight from './Highlight';
import MoveClassificationBadges from './MoveClassificationBadges';
import MoveInteraction from './MoveInteraction';
import Pieces from './Pieces';
import PlayerBadge from './PlayerBadge';

import '../../styles/board.css';

if (!import.meta.env.PROD) {
  mountStoreDevtool('selectGameStore', useSelectGameStore);
  mountStoreDevtool('boardStore', useBoardStore);
  mountStoreDevtool('stockfishOutputStore', useStockfishOutputStore);
  mountStoreDevtool('settingsStore', useSettingsStore);
  mountStoreDevtool('evalStore', useEvalStore);
  mountStoreDevtool('stageStore', useStageStore);
  mountStoreDevtool('manualHighlightStore', useManualHighlightStore);
}

export default function Board() {
  useSoundFx();
  const interaction = useBoardInteraction();
  const variationFen = useVariationStore(state => state.fen);

  const {
    currentGame,
    isFlipped,
    flipBoard,
  } = useBoardStore(useShallow(state => ({
    currentGame: state.currentGame,
    isFlipped: state.isFlipped,
    flipBoard: state.flipBoard,
  })));

  const isLoaded = useStageStore(state => state.computed.isLoaded);
  const username = useSelectGameStore(state => state.username);
  const { board } = useSettingsStore(state => state.settings);

  useEffect(() => {
    if (isLoaded && username) {
      // if game loaded through a site
      const white = currentGame.header().White;

      if (username.toLowerCase() === white.toLowerCase()) {
        flipBoard(false);
      }
      else {
        flipBoard(true);
      }
    }
  }, [isLoaded]);

  return (
    <div className="board-workspace" id="Board">
      <PlayerBadge color={isFlipped ? 'w' : 'b'} />
      <div className="board-with-evaluation" id="Board&Bar">
        <EvalBar />
        <div
          aria-label={interaction.enabled ? 'Chessboard. Use arrow keys and Enter to try alternative moves.' : 'Chessboard'}
          className="group chessboard"
          id="actual-board"
          role={interaction.enabled ? 'application' : undefined}
          tabIndex={interaction.enabled ? 0 : undefined}
          {...interaction.handlers}
        >
          <img
            alt=""
            className="board-squares"
            src={`/boards/${board}.png`}
          />
          {!variationFen && <Highlight />}
          <Coors />
          <Pieces />
          <Arrows />
          {!variationFen && <MoveClassificationBadges />}
          {!variationFen && <EndgameBadges />}
          <MoveInteraction interaction={interaction} />
        </div>
      </div>
      <PlayerBadge color={isFlipped ? 'b' : 'w'} />
    </div>
  );
}
