import { Button } from '@heroui/react';

import { useBatchStore } from '../../stores/useBatchStore';
import { useStageStore } from '../../stores/useStageStore';

export default function BatchProgress() {
  const { active, completed, total, error, cancel } = useBatchStore();

  if (!total && !error)
    return null;

  return (
    <div
      className="mx-auto mb-4 flex max-w-[1146px] items-center gap-3 text-small"
      role="status"
    >
      <p>
        {error || `${completed} of ${total} games reviewed${active ? ` · Analyzing game ${completed + 1}` : completed === total ? ' · Complete' : ' · Stopped'}`}
      </p>
      {active && (
        <Button
          onPress={() => {
            cancel();
            useStageStore.getState().setStage('loaded');
          }}
          size="sm"
          variant="flat"
        >
          Stop batch
        </Button>
      )}
    </div>
  );
}
