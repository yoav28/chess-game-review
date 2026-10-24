import { create } from 'zustand';

export type Pieces = 'neo' | 'classic' | 'ocean';
export type Board = 'green' | 'brown' | 'ice';
export type AnalysisModel = 'nnue' | 'classical';

interface SettingsStore {
  settings: {
    showRatings: boolean;
    pieces: Pieces;
    board: Board;
    analysisModel: AnalysisModel;
    analysisDepth: number;
    autoplayInterval: number;
  };
  toggleShowRatings: () => void;
  choosePieces: (pieces: Pieces) => void;
  chooseBoard: (board: Board) => void;
  chooseAnalysisModel: (model: AnalysisModel) => void;
  chooseAnalysisDepth: (depth: number) => void;
  chooseAutoplayInterval: (interval: number) => void;
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  }
  catch {
    return null;
  }
}

function write(key: string, value: string | number | boolean) {
  try {
    localStorage.setItem(key, String(value));
  }
  catch {}
}

const storedDepth = Number(read('analysisDepth'));
const storedInterval = Number(read('autoplayInterval'));

export const useSettingsStore = create<SettingsStore>(set => ({
  settings: {
    showRatings: read('showRatings') !== 'false',
    pieces: (['neo', 'classic', 'ocean'].includes(read('pieces') ?? '') ? read('pieces') : 'neo') as Pieces,
    board: (['green', 'brown', 'ice'].includes(read('board') ?? '') ? read('board') : 'green') as Board,
    analysisModel: read('analysisModel') === 'classical' ? 'classical' : 'nnue',
    analysisDepth: Number.isInteger(storedDepth) && storedDepth >= 8 && storedDepth <= 24 ? storedDepth : 12,
    autoplayInterval: storedInterval >= 0.5 && storedInterval <= 5 ? storedInterval : 1,
  },
  toggleShowRatings: () => set(({ settings }) => {
    write('showRatings', !settings.showRatings);

    return { settings: { ...settings, showRatings: !settings.showRatings } };
  }),
  choosePieces: pieces => set(({ settings }) => {
    write('pieces', pieces);

    return { settings: { ...settings, pieces } };
  }),
  chooseBoard: board => set(({ settings }) => {
    write('board', board);

    return { settings: { ...settings, board } };
  }),
  chooseAnalysisModel: analysisModel => set(({ settings }) => {
    write('analysisModel', analysisModel);

    return { settings: { ...settings, analysisModel } };
  }),
  chooseAnalysisDepth: depth => set(({ settings }) => {
    const analysisDepth = Math.max(8, Math.min(24, Math.round(depth)));
    write('analysisDepth', analysisDepth);

    return { settings: { ...settings, analysisDepth } };
  }),
  chooseAutoplayInterval: interval => set(({ settings }) => {
    const autoplayInterval = Math.max(0.5, Math.min(5, interval));
    write('autoplayInterval', autoplayInterval);

    return { settings: { ...settings, autoplayInterval } };
  }),
}));
