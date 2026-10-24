import { Button } from '@heroui/react';

import { useBoardStore } from '../../stores/useBoardStore';
import { useReviewViewStore } from '../../stores/useReviewViewStore';
import { useStageStore } from '../../stores/useStageStore';

export default function ReviewStartButton() {
  return (
    <div className="review-overview-footer">
      <Button
        className="review-primary-button review-start-button"
        color="primary"
        fullWidth
        onPress={() => {
          useReviewViewStore.getState().setView('review');
          useStageStore.getState().setStage('review-moves');
          if (useBoardStore.getState().currentMoveNum === 0)
            useBoardStore.getState().toNextMove();
        }}
        radius="sm"
      >
        Start Review
      </Button>
    </div>
  );
}
