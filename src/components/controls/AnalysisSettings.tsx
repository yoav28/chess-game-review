import { useSettingsStore } from '../../stores/useSettingsStore';

import type { AnalysisModel } from '../../stores/useSettingsStore';

export default function AnalysisSettings() {
  const { analysisModel, analysisDepth } = useSettingsStore(state => state.settings);
  const chooseAnalysisModel = useSettingsStore(state => state.chooseAnalysisModel);
  const chooseAnalysisDepth = useSettingsStore(state => state.chooseAnalysisDepth);

  return (
    <>
      <label className="chess-setting-field">
        <span>Chess Engine</span>
        <select onChange={event => chooseAnalysisModel(event.target.value as AnalysisModel)} value={analysisModel}>
          <option value="nnue">Stockfish NNUE</option>
          <option value="classical">Stockfish Classical</option>
        </select>
      </label>
      <label className="chess-setting-field">
        <span>Analysis Depth</span>
        <select onChange={event => chooseAnalysisDepth(Number(event.target.value))} value={analysisDepth}>
          {Array.from({ length: 17 }, (_, i) => i + 8).map(depth => <option key={depth} value={depth}>{depth}</option>)}
        </select>
      </label>
    </>
  );
}
