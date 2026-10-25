export const boardThemes = {
  sage: { label: 'Green', light: '#eeeed2', dark: '#769656', lightText: '#3c4932', darkText: '#172313', lastLight: '#f6f669', lastDark: '#baca44', selected: '#f6f669' },
  walnut: { label: 'Brown & white', light: '#ffffff', dark: '#9a7557', lightText: '#593b27', darkText: '#100d08', lastLight: '#e4cf88', lastDark: '#b7a15f', selected: '#c9b66b' },
  graphite: { label: 'Graphite', light: '#f3f3ec', dark: '#8b9095', lightText: '#42474b', darkText: '#1d2022', lastLight: '#dfdfa2', lastDark: '#a9af78', selected: '#c7c98a' },
  contrast: { label: 'High contrast', light: '#ffffff', dark: '#545454', lightText: '#303030', darkText: '#ffffff', lastLight: '#f1e290', lastDark: '#7b6b25', selected: '#d1b956' },
} as const

export const pieceSets = { classic: 'Classic', neo: 'Neo', geometric: 'Geometric', letters: 'Letters' } as const
export type BoardTheme = keyof typeof boardThemes
export type PieceSet = keyof typeof pieceSets
export type BoardAppearance = { boardTheme: BoardTheme; pieceSet: PieceSet; coordinates: boolean }
export const defaultBoardAppearance: BoardAppearance = { boardTheme: 'walnut', pieceSet: 'neo', coordinates: true }

export function normalizeBoardAppearance(value: unknown): BoardAppearance {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    boardTheme: typeof source.boardTheme === 'string' && Object.hasOwn(boardThemes, source.boardTheme) ? source.boardTheme as BoardTheme : defaultBoardAppearance.boardTheme,
    pieceSet: typeof source.pieceSet === 'string' && Object.hasOwn(pieceSets, source.pieceSet) ? source.pieceSet as PieceSet : defaultBoardAppearance.pieceSet,
    coordinates: typeof source.coordinates === 'boolean' ? source.coordinates : true,
  }
}

export function boardAppearanceStyle(appearance: BoardAppearance) {
  const theme = boardThemes[appearance.boardTheme]
  return { '--board-light': theme.light, '--board-dark': theme.dark, '--board-light-text': theme.lightText, '--board-dark-text': theme.darkText,
    '--board-last-light': theme.lastLight, '--board-last-dark': theme.lastDark, '--board-selected': theme.selected }
}
