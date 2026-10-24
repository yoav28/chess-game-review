import { createContext, useContext } from 'react'
import { defaultBoardAppearance, type BoardAppearance } from '../lib/board-appearance'

export const BoardAppearanceContext = createContext<{ appearance: BoardAppearance; onChange: (patch: Partial<BoardAppearance>) => void }>({ appearance: defaultBoardAppearance, onChange: () => undefined })
export const useBoardAppearance = () => useContext(BoardAppearanceContext)
