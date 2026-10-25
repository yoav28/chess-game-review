import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { createPosition, positionMoveUci, type ChessVariant } from '../lib/position'
import { variantLabel } from '../lib/variants'
import type { PieceSymbol, Square } from 'chess.js'
import { classificationGlyph } from '../lib/classification'
import { classificationLabels, type Classification } from '../lib/review'
import { Piece } from './ChessPiece'
import { useBoardAppearance } from './BoardAppearanceContext'
import { boardAppearanceStyle } from '../lib/board-appearance'
import './Board.css'
export { Piece } from './ChessPiece'

type BoardProps = {
  variant?: ChessVariant
  fen: string
  orientation: 'w' | 'b'
  lastMove?: { from: string; to: string }
  bestMove?: string
  showBestMove?: boolean
  coachArrows?: { from: string; to: string }[]
  threatArrow?: { from: string; to: string }
  classification?: { square: string; kind: Classification }
  onMove?: (uci: string) => void
  disabled?: boolean
  arrows?: boolean
}

type Annotation = { from: string; to: string }
const pieceNames: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const files = 'abcdefgh'

export default function Board({ fen, variant, orientation, lastMove, bestMove, showBestMove = false, coachArrows = [], threatArrow, classification, onMove, disabled = false, arrows = true }: BoardProps) {
  const { appearance } = useBoardAppearance()
  const chess = useMemo(() => createPosition(fen, variant), [fen, variant])
  const [selected, setSelected] = useState<Square | null>(null)
  const [selectedDrop, setSelectedDrop] = useState<PieceSymbol | null>(null)
  const [promotion, setPromotion] = useState<Annotation | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [focusIndex, setFocusIndex] = useState(56)
  const annotationStart = useRef<string | null>(null)
  const dragged = useRef(false)
  const squaresRef = useRef<(HTMLButtonElement | null)[]>([])
  const markerId = `board-arrow-${useId().replace(/:/g, '')}`
  const squares = useMemo(() => Array.from({ length: 64 }, (_, index) => {
    const file = orientation === 'w' ? index % 8 : 7 - index % 8
    const rank = orientation === 'w' ? 8 - Math.floor(index / 8) : 1 + Math.floor(index / 8)
    return `${files[file]}${rank}` as Square
  }), [orientation])
  const pockets = chess.pockets?.()
  const crazyhouse = variant === 'crazyhouse'
  const legalMoves = selectedDrop ? chess.moves({ verbose: true }).filter(move => move.drop === selectedDrop) : selected ? chess.moves({ square: selected, verbose: true }) : []
  const outcome = chess.variantOutcome?.()
  const turnDescription = outcome ? outcome.winner ? `${outcome.winner === 'w' ? 'White' : 'Black'} wins under ${variantLabel(variant)} rules.` : 'Drawn position.' : chess.isCheckmate() ? `${chess.turn() === 'w' ? 'Black' : 'White'} wins by checkmate.` : chess.isDraw() ? 'Drawn position.' : `${chess.turn() === 'w' ? 'White' : 'Black'} to move.`

  useEffect(() => {
    setSelected(null)
    setSelectedDrop(null)
    setPromotion(null)
    setAnnotations([])
  }, [fen, variant])

  function attemptMove(from: string, to: string) {
    if (disabled || !onMove || !/^[a-h][1-8]$/.test(to)) return false
    if (selectedDrop) {
      const move = chess.moves({ verbose: true }).find(candidate => candidate.drop === selectedDrop && candidate.to === to)
      if (!move) return false
      onMove(positionMoveUci(move))
      setSelected(null)
      setSelectedDrop(null)
      setAnnotations([])
      return true
    }
    if (!/^[a-h][1-8]$/.test(from)) return false
    const candidates = chess.moves({ square: from as Square, verbose: true }).filter(move => move.to === to)
    if (!candidates.length) return false
    if (candidates.some(move => move.promotion)) setPromotion({ from, to })
    else {
      setSelected(null)
      setAnnotations([])
      onMove(`${from}${to}`)
    }
    return true
  }

  function selectSquare(square: Square) {
    if (disabled || promotion || dragged.current) return
    setAnnotations([])
    if (selectedDrop && attemptMove(square, square)) return
    if (selected && attemptMove(selected, square)) return
    setSelectedDrop(null)
    const piece = chess.get(square)
    setSelected(piece?.color === chess.turn() && selected !== square ? square : null)
  }

  function finishAnnotation(square: string) {
    const from = annotationStart.current
    annotationStart.current = null
    if (!from || !arrows) return
    setAnnotations(current => current.some(item => item.from === from && item.to === square)
      ? current.filter(item => item.from !== from || item.to !== square)
      : [...current, { from, to: square }])
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }
    if (event.key === 'Escape') {
      setSelected(null)
      setPromotion(null)
      setAnnotations([])
      return
    }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = index + offset
    if (next < 0 || next > 63 || (Math.abs(offset) === 1 && Math.floor(next / 8) !== Math.floor(index / 8))) return
    setFocusIndex(next)
    squaresRef.current[next]?.focus()
  }

  function center(square: string) {
    const index = squares.indexOf(square as Square)
    return { x: (index % 8) * 100 + 50, y: Math.floor(index / 8) * 100 + 50 }
  }

  function pocket(color: 'w' | 'b') {
    const pieces = pockets?.[color] ?? {}
    const entries = Object.entries(pieces) as [PieceSymbol, number][]
    return <div className={`board-pocket ${color === 'w' ? 'board-pocket-white' : 'board-pocket-black'}`} role="group" aria-label={`${color === 'w' ? 'White' : 'Black'} pocket`}>
      {entries.map(([type, count]) => <button type="button" key={type} className={`board-pocket-piece ${selectedDrop === type && chess.turn() === color ? 'board-pocket-selected' : ''}`} aria-label={`Drop ${color === 'w' ? 'white' : 'black'} ${pieceNames[type]}, ${count} available`} aria-pressed={selectedDrop === type && chess.turn() === color} disabled={disabled || !onMove || chess.turn() !== color} onClick={() => { setSelected(null); setSelectedDrop(current => current === type ? null : type) }}>
        <Piece type={type} color={color} set={appearance.pieceSet} /><span>{count}</span>
      </button>)}
    </div>
  }

  const visibleArrows: (Annotation & { kind: 'annotation' | 'best' | 'coach' | 'threat' })[] = annotations.filter(item => item.from !== item.to).map(item => ({ ...item, kind: 'annotation' }))
  if (showBestMove && bestMove && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) visibleArrows.push({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), kind: 'best' })
  visibleArrows.push(...coachArrows.filter(item => /^[a-h][1-8]$/.test(item.from) && /^[a-h][1-8]$/.test(item.to) && item.from !== item.to).map(item => ({ ...item, kind: 'coach' as const })))
  if (threatArrow && /^[a-h][1-8]$/.test(threatArrow.from) && /^[a-h][1-8]$/.test(threatArrow.to) && threatArrow.from !== threatArrow.to) visibleArrows.push({ ...threatArrow, kind: 'threat' })

  return (
    <div className={`review-board${crazyhouse ? ' crazyhouse-board' : ''}`} style={boardAppearanceStyle(appearance) as CSSProperties} onContextMenu={event => event.preventDefault()}>
      {crazyhouse && pocket(orientation === 'w' ? 'b' : 'w')}
      <div className="board-area">
      <div className="board-squares" role="grid" aria-label={`Chessboard, ${orientation === 'w' ? 'white' : 'black'} perspective. ${turnDescription} Use arrow keys to navigate, Enter to select a piece and destination.`}>
        {squares.map((square, index) => {
          const piece = chess.get(square)
          const dark = (files.indexOf(square[0]) + Number(square[1])) % 2 === 0
          const legal = legalMoves.some(move => move.to === square)
          const checked = piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck()
          const circled = annotations.some(item => item.from === square && item.to === square)
          const badge = classification?.square === square && Object.hasOwn(classificationGlyph, classification.kind) ? classification.kind : null
          const classes = ['board-square', dark ? 'square-dark' : 'square-light', selected === square ? 'square-selected' : '', square === lastMove?.from || square === lastMove?.to ? 'square-last-move' : '', checked ? 'square-check' : '', legal ? piece ? 'square-capture' : 'square-legal' : '', circled ? 'square-circled' : ''].filter(Boolean).join(' ')
          return (
            <button
              key={square}
              ref={element => { squaresRef.current[index] = element }}
              type="button"
              role="gridcell"
              className={classes}
              tabIndex={focusIndex === index ? 0 : -1}
              aria-label={`${square}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${pieceNames[piece.type]}` : ', empty'}${legal ? ', legal destination' : ''}${checked ? ', in check' : ''}${badge ? `, ${classificationLabels[badge]} move` : ''}`}
              aria-selected={selected === square}
              onFocus={() => setFocusIndex(index)}
              onKeyDown={event => moveFocus(event, index)}
              onClick={() => selectSquare(square)}
              onMouseDown={event => { if (event.button === 2 && arrows) annotationStart.current = square }}
              onMouseUp={event => { if (event.button === 2) finishAnnotation(square) }}
              draggable={!disabled && !!onMove && piece?.color === chess.turn()}
              onDragStart={event => {
                dragged.current = true
                setSelected(square)
                event.dataTransfer.setData('text/plain', square)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={event => { if (!disabled) event.preventDefault() }}
              onDrop={event => {
                event.preventDefault()
                attemptMove(event.dataTransfer.getData('text/plain'), square)
              }}
              onDragEnd={() => { dragged.current = false }}
            >
              {piece && <Piece type={piece.type} color={piece.color} set={appearance.pieceSet} />}
              {badge && <span className={`board-classification ${badge}`} aria-hidden="true">{classificationGlyph[badge]}</span>}
              {appearance.coordinates && index % 8 === 0 && <span className="board-coordinate coordinate-rank" aria-hidden="true">{square[1]}</span>}
              {appearance.coordinates && index >= 56 && <span className="board-coordinate coordinate-file" aria-hidden="true">{square[0]}</span>}
            </button>
          )
        })}
      </div>
      {visibleArrows.length > 0 && (
        <svg className="board-arrows" viewBox="0 0 800 800" aria-hidden="true">
          <defs>{(['annotation', 'best', 'coach', 'threat'] as const).map(kind => <marker key={kind} id={`${markerId}-${kind}`} className={`board-arrow-${kind}`} markerWidth="2.5" markerHeight="2.5" refX="1.2" refY="1.25" orient="auto"><path d="M0 0 2.5 1.25 0 2.5z" fill="currentColor" /></marker>)}</defs>
          {visibleArrows.map((arrow, index) => {
            const start = center(arrow.from)
            const end = center(arrow.to)
            const angle = Math.atan2(end.y - start.y, end.x - start.x)
            return <line key={`${arrow.kind}-${arrow.from}-${arrow.to}-${index}`} className={`board-arrow-${arrow.kind}`} x1={start.x} y1={start.y} x2={end.x - Math.cos(angle) * 19} y2={end.y - Math.sin(angle) * 19} stroke="currentColor" strokeWidth={arrow.kind === 'coach' ? 11 : 17} strokeLinecap="round" markerEnd={`url(#${markerId}-${arrow.kind})`} />
          })}
        </svg>
      )}
      {promotion && (
        <div className="board-promotion-backdrop" onKeyDown={event => { if (event.key === 'Escape') setPromotion(null) }}>
          <div className="board-promotion" role="dialog" aria-modal="true" aria-label="Choose a promotion piece">
            <span>Promote pawn</span>
            <div className="board-promotion-options">
              {(['q', 'r', 'b', 'n'] as const).map((type, index) => <button type="button" key={type} autoFocus={index === 0} aria-label={`Promote to ${pieceNames[type]}`} onClick={() => { onMove?.(`${promotion.from}${promotion.to}${type}`); setSelected(null); setPromotion(null) }}><Piece type={type} color={chess.turn()} set={appearance.pieceSet} /></button>)}
            </div>
            <button type="button" className="board-promotion-cancel" onClick={() => setPromotion(null)}>Cancel</button>
          </div>
        </div>
      )}
      </div>
      {crazyhouse && pocket(orientation === 'w' ? 'w' : 'b')}
    </div>
  )
}
