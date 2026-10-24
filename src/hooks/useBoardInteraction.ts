import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'react';

import { useBoardStore } from '../stores/useBoardStore';
import { useStageStore } from '../stores/useStageStore';
import { useVariationStore } from '../stores/useVariationStore';

import type { PieceSymbol, Square } from 'chess.js';
import type { KeyboardEvent, PointerEvent } from 'react';

export default function useBoardInteraction() {
  const currentGame = useBoardStore(state => state.currentGame);
  const currentMoveNum = useBoardStore(state => state.currentMoveNum);
  const randomState = useBoardStore(state => state.randomState);
  const isFlipped = useBoardStore(state => state.isFlipped);
  const enabled = useStageStore(state => state.stage === 'review-moves' || state.stage === 'review-overview');
  const { fen, play, reset } = useVariationStore();
  const [selected, setSelected] = useState<Square | null>(null);
  const [focused, setFocused] = useState<Square>('e2');
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const pointerStart = useRef<Square | null>(null);
  const history = currentGame.history({ verbose: true });
  const sourceFen = currentMoveNum > 0 ? history[currentMoveNum - 1].after : history[0]?.before ?? currentGame.fen();
  const game = new Chess(fen ?? sourceFen);
  const legalMoves = selected ? game.moves({ square: selected, verbose: true }) : [];

  useEffect(() => {
    reset();
    setSelected(null);
    setPromotion(null);
  }, [currentMoveNum, randomState, enabled, reset]);

  function move(from: Square, to: Square, piece?: PieceSymbol) {
    const candidates = game.moves({ square: from, verbose: true }).filter(move => move.to === to);

    if (candidates.length === 0)
      return false;

    if (candidates.some(move => move.promotion) && !piece) {
      setPromotion({ from, to });

      return true;
    }

    play(sourceFen, from, to, piece);
    setSelected(null);
    setPromotion(null);

    return true;
  }

  function choose(square: Square) {
    if (selected && move(selected, square))
      return;
    const piece = game.get(square);
    setSelected(piece?.color === game.turn() ? square : null);
    setFocused(square);
  }

  function squareAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * 8);
    const y = Math.floor((event.clientY - rect.top) / rect.height * 8);

    if (x < 0 || x > 7 || y < 0 || y > 7)
      return null;

    return `${'abcdefgh'[isFlipped ? 7 - x : x]}${isFlipped ? y + 1 : 8 - y}` as Square;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.button !== 0 || promotion)
      return;
    useStageStore.getState().setStage('review-moves');
    pointerStart.current = squareAt(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.button !== 0 || promotion)
      return;
    const from = pointerStart.current;
    const to = squareAt(event);
    pointerStart.current = null;

    if (!from || !to)
      return;

    if (from !== to) {
      if (!move(from, to))
        setSelected(null);
    }
    else {
      choose(to);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!enabled || promotion)
      return;
    if (['Enter', ' ', 'Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key))
      useStageStore.getState().setStage('review-moves');

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      choose(focused);
    }
    else if (event.key === 'Escape') {
      setSelected(null);
      reset();
    }
    else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      event.stopPropagation();
      const direction = isFlipped ? -1 : 1;
      const file = focused.charCodeAt(0) - 97;
      const rank = Number(focused[1]);
      const dx = event.key === 'ArrowRight' ? direction : event.key === 'ArrowLeft' ? -direction : 0;
      const dy = event.key === 'ArrowUp' ? direction : event.key === 'ArrowDown' ? -direction : 0;
      setFocused(`${'abcdefgh'[Math.max(0, Math.min(7, file + dx))]}${Math.max(1, Math.min(8, rank + dy))}` as Square);
    }
  }

  return {
    enabled,
    selected,
    focused,
    destinations: [...new Set(legalMoves.map(move => move.to))],
    promotion,
    promote: (piece: PieceSymbol) => promotion && move(promotion.from, promotion.to, piece),
    cancelPromotion: () => setPromotion(null),
    color: game.turn(),
    handlers: { onPointerDown, onPointerUp, onKeyDown },
  };
}
