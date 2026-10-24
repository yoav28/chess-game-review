import { Select, SelectItem } from '@heroui/react';

import { useSettingsStore } from '../../stores/useSettingsStore';

import type { AnalysisModel } from '../../stores/useSettingsStore';

export default function AnalysisSettings() {
  const { analysisModel, analysisDepth, autoplayInterval } = useSettingsStore(state => state.settings);
  const chooseAnalysisModel = useSettingsStore(state => state.chooseAnalysisModel);
  const chooseAnalysisDepth = useSettingsStore(state => state.chooseAnalysisDepth);
  const chooseAutoplayInterval = useSettingsStore(state => state.chooseAutoplayInterval);

  return (
    <>
      <hr className="border-default-200" />
      <Select
        description="Applies to the next review and alternative moves."
        label="Analysis model"
        onSelectionChange={(keys) => {
          const model = Array.from(keys)[0];
          if (model)
            chooseAnalysisModel(model as AnalysisModel);
        }}
        selectedKeys={[analysisModel]}
        size="sm"
      >
        <SelectItem key="nnue">Stockfish NNUE</SelectItem>
        <SelectItem key="classical">Stockfish Classical</SelectItem>
      </Select>
      <Select
        description="Higher depth takes longer."
        label="Analysis depth"
        onSelectionChange={(keys) => {
          const depth = Array.from(keys)[0];
          if (depth)
            chooseAnalysisDepth(Number(depth));
        }}
        selectedKeys={[String(analysisDepth)]}
        size="sm"
      >
        {Array.from({ length: 17 }, (_, i) => i + 8).map(depth => <SelectItem key={String(depth)}>{String(depth)}</SelectItem>)}
      </Select>
      <Select
        label="Playback interval"
        onSelectionChange={(keys) => {
          const interval = Array.from(keys)[0];
          if (interval)
            chooseAutoplayInterval(Number(interval));
        }}
        selectedKeys={[String(autoplayInterval)]}
        size="sm"
      >
        {[0.5, 1, 2, 3, 5].map(interval => <SelectItem key={String(interval)}>{`${interval} ${interval === 1 ? 'second' : 'seconds'}`}</SelectItem>)}
      </Select>
    </>
  );
}
