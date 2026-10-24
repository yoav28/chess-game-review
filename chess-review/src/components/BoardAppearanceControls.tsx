import { useId, type CSSProperties } from 'react'
import { boardAppearanceStyle, boardThemes, pieceSets, type BoardAppearance } from '../lib/board-appearance'
import { Piece } from './ChessPiece'
import './BoardAppearanceControls.css'

export function BoardAppearanceControls({ value, onChange }: { value: BoardAppearance; onChange: (patch: Partial<BoardAppearance>) => void }) {
  const id = useId()
  return <div className="board-appearance-controls">
    <label htmlFor={`${id}-board`}>Board</label>
    <select id={`${id}-board`} value={value.boardTheme} onChange={event => onChange({ boardTheme: event.target.value as BoardAppearance['boardTheme'] })}>{Object.entries(boardThemes).map(([key, theme]) => <option key={key} value={key}>{theme.label}</option>)}</select>
    <label htmlFor={`${id}-pieces`}>Pieces</label>
    <select id={`${id}-pieces`} value={value.pieceSet} onChange={event => onChange({ pieceSet: event.target.value as BoardAppearance['pieceSet'] })}>{Object.entries(pieceSets).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    <div className="appearance-preview" role="img" aria-label={`${boardThemes[value.boardTheme].label} board, ${pieceSets[value.pieceSet]} pieces`} style={boardAppearanceStyle(value) as CSSProperties}>
      <span><Piece type="n" color="w" set={value.pieceSet} /></span><span><Piece type="n" color="b" set={value.pieceSet} /></span>
    </div>
    <label className="checkbox-label"><input type="checkbox" checked={value.coordinates} onChange={event => onChange({ coordinates: event.target.checked })} />Coordinates</label>
    <p className="fine-print">Applies to the board and new image, GIF, and HTML exports. Piece artwork is original to Open File.</p>
  </div>
}
