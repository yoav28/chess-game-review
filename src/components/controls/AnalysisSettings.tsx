import { useSettingsStore } from '../../stores/useSettingsStore';

import type { AnalysisModel } from '../../stores/useSettingsStore';

export default function AnalysisSettings() {
  const { analysisModel, analysisDepth, autoplayInterval } = useSettingsStore(state => state.settings);
  const chooseAnalysisModel = useSettingsStore(state => state.chooseAnalysisModel);
  const chooseAnalysisDepth = useSettingsStore(state => state.chooseAnalysisDepth);
  const chooseAutoplayInterval = useSettingsStore(state => state.chooseAutoplayInterval);

  return (
    <>
      <hr className="chess-settings-divider" />
      <label className="chess-setting-field">
        <span>Analysis model</span>
        <select onChange={event => chooseAnalysisModel(event.target.value as AnalysisModel)} value={analysisModel}>
          <option value="nnue">Stockfish NNUE</option>
          <option value="classical">Stockfish Classical</option>
        </select>
        <small>Applies to the next review and alternative moves.</small>
      </label>
      <label className="chess-setting-field">
        <span>Analysis depth</span>
        <select onChange={event => chooseAnalysisDepth(Number(event.target.value))} value={analysisDepth}>
          {Array.from({ length: 17 }, (_, i) => i + 8).map(depth => <option key={depth} value={depth}>{depth}</option>)}
        </select>
        <small>Higher depth takes longer.</small>
      </label>
      <label className="chess-setting-field">
        <span>Playback interval</span>
        <select onChange={event => chooseAutoplayInterval(Number(event.target.value))} value={autoplayInterval}>
          {[0.5, 1, 2, 3, 5].map(interval => <option key={interval} value={interval}>{`${interval} ${interval === 1 ? 'second' : 'seconds'}`}</option>)}
        </select>
      </label>
    </>
  );
}
