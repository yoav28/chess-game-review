import { Button } from '@heroui/react';

import { useBoardStore } from '../../stores/useBoardStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import translatePiece from '../../utils/translatePiece';

import type useBoardInteraction from '../../hooks/useBoardInteraction';

export default function MoveInteraction({ interaction }: { interaction: ReturnType<typeof useBoardInteraction> }) {
  const isFlipped = useBoardStore(state => state.isFlipped);
  const theme = useSettingsStore(state => state.settings.pieces);
  const { enabled, selected, focused, destinations, promotion, promote, cancelPromotion, color } = interaction;

  if (!enabled)
    return null;
  const [focusX, focusY] = translatePiece(focused, isFlipped);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className={`
          absolute size-[12.5%] border-2 border-foreground opacity-0
          group-focus-visible:opacity-100
        `}
        style={{ transform: `translate(${focusX}%, ${focusY}%)` }}
      />
      {[...new Set([selected, ...destinations])].filter(Boolean).map((square) => {
        const [x, y] = translatePiece(square!, isFlipped);

        return (
          <div
            className={`
              absolute size-[12.5%] border-2 border-primary bg-primary/25
            `}
            key={square}
            style={{ transform: `translate(${x}%, ${y}%)` }}
          />
        );
      })}
      <span className="sr-only">
        Focused square
        {focused}
        . Use arrow keys, then Enter to select a piece and its destination.
      </span>
      {promotion && (
        <div
          aria-label="Promote pawn"
          aria-modal="true"
          className={`
            pointer-events-auto absolute inset-0 z-10 flex flex-col items-center
            justify-center gap-3 bg-background/90
          `}
          onPointerDown={event => event.stopPropagation()}
          onPointerUp={event => event.stopPropagation()}
          role="dialog"
        >
          <p className="font-bold">Promote pawn</p>
          <div className="flex gap-2">
            {(['q', 'r', 'b', 'n'] as const).map((piece, index) => (
              <Button aria-label={`Promote to ${['queen', 'rook', 'bishop', 'knight'][index]}`} autoFocus={index === 0} isIconOnly key={piece} onPress={() => promote(piece)} radius="sm" variant="flat">
                <img alt="" className="size-9" src={`/pieces/${theme}/${color}${piece}.png`} />
              </Button>
            ))}
          </div>
          <Button onPress={cancelPromotion} radius="sm" size="sm" variant="light">Cancel</Button>
        </div>
      )}
    </div>
  );
}
