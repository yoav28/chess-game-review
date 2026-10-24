import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Chess } from 'chess.js'
import type { PieceSymbol, Square } from 'chess.js'
import './Board.css'

type BoardProps = {
  fen: string
  orientation: 'w' | 'b'
  lastMove?: { from: string; to: string }
  bestMove?: string
  showBestMove?: boolean
  onMove?: (uci: string) => void
  disabled?: boolean
  arrows?: boolean
}

type Annotation = { from: string; to: string }
const pieceNames: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const files = 'abcdefgh'

function Piece({ type, color }: { type: PieceSymbol; color: 'w' | 'b' }) {
  return (
    <svg className={`chess-piece chess-piece-${color}`} viewBox="0 0 80 80" aria-hidden="true">
      <g strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        {type === 'p' && <><circle cx="40" cy="24" r="9" /><path d="M32 34h16l-3 9 6 15H29l6-15z" /><path d="M26 59h28l3 9H23z" /></>}
        {type === 'r' && <><path d="M23 15h9v9h8v-9h8v9h8v-9h6v20l-8 7 2 16H28l2-16-7-7z" /><path d="M25 58h32l3 10H22z" /><path d="M30 36h24M30 52h24" /></>}
        {type === 'n' && <><path d="m24 57 5-14 13-11-10 1-9 7-7-7 12-18 13 1 4-7 5 12c12 9 13 24 8 36z" /><path d="m25 57-4 11h41l-4-11z" /><path d="m31 24 3-3m15 9c7 7 7 15 5 21" fill="none" /><circle cx="38" cy="22" r="1.6" className="chess-piece-detail" stroke="none" /></>}
        {type === 'b' && <><circle cx="40" cy="12" r="4" /><path d="M40 17c-8 8-15 15-12 22 2 5 7 6 8 9l-7 10h22l-7-10c1-3 6-4 8-9 3-7-4-14-12-22z" /><path d="m44 24-9 14" fill="none" /><path d="M26 58h28l6 10H20z" /><path d="M32 47h16" fill="none" /></>}
        {type === 'q' && <><path d="m20 26 12 10 8-14 8 14 12-10-8 27H28z" /><circle cx="19" cy="22" r="4" /><circle cx="40" cy="18" r="4" /><circle cx="61" cy="22" r="4" /><path d="M28 53h24l3 7H25zM25 60h30l5 8H20z" /><path d="M29 46h22" fill="none" /></>}
        {type === 'k' && <><path d="M40 9v16m-7-10h14" fill="none" strokeWidth="4" /><path d="M40 30c-12-15-27-3-19 9l10 14h18l10-14c8-12-7-24-19-9z" /><path d="M31 53h18l5 7H26zM26 60h28l5 8H21z" /><path d="M40 31v16" fill="none" /></>}
      </g>
    </svg>
  )
}

export default function Board({ fen, orientation, lastMove, bestMove, showBestMove = false, onMove, disabled = false, arrows = true }: BoardProps) {
  const chess = useMemo(() => new Chess(fen), [fen])
  const [selected, setSelected] = useState<Square | null>(null)
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
  const legalMoves = selected ? chess.moves({ square: selected, verbose: true }) : []

  useEffect(() => {
    setSelected(null)
    setPromotion(null)
    setAnnotations([])
  }, [fen])

  function attemptMove(from: string, to: string) {
    if (disabled || !onMove || !/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return false
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
    if (selected && attemptMove(selected, square)) return
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

  const visibleArrows = annotations.filter(item => item.from !== item.to)
  if (showBestMove && bestMove && /^[a-h][1-8][a-h][1-8]/.test(bestMove)) visibleArrows.push({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) })

  return (
    <div className="review-board" onContextMenu={event => event.preventDefault()}>
      <div className="board-squares" role="grid" aria-label={`Chessboard, ${orientation === 'w' ? 'white' : 'black'} perspective. ${chess.turn() === 'w' ? 'White' : 'Black'} to move. Use arrow keys to navigate, Enter to select a piece and destination.`}>
        {squares.map((square, index) => {
          const piece = chess.get(square)
          const dark = (files.indexOf(square[0]) + Number(square[1])) % 2 === 0
          const legal = legalMoves.some(move => move.to === square)
          const checked = piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck()
          const circled = annotations.some(item => item.from === square && item.to === square)
          const classes = ['board-square', dark ? 'square-dark' : 'square-light', selected === square ? 'square-selected' : '', square === lastMove?.from || square === lastMove?.to ? 'square-last-move' : '', checked ? 'square-check' : '', legal ? piece ? 'square-capture' : 'square-legal' : '', circled ? 'square-circled' : ''].filter(Boolean).join(' ')
          return (
            <button
              key={square}
              ref={element => { squaresRef.current[index] = element }}
              type="button"
              role="gridcell"
              className={classes}
              tabIndex={focusIndex === index ? 0 : -1}
              aria-label={`${square}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${pieceNames[piece.type]}` : ', empty'}${legal ? ', legal destination' : ''}${checked ? ', in check' : ''}`}
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
              {piece && <Piece type={piece.type} color={piece.color} />}
              {index % 8 === 0 && <span className="board-coordinate coordinate-rank" aria-hidden="true">{square[1]}</span>}
              {index >= 56 && <span className="board-coordinate coordinate-file" aria-hidden="true">{square[0]}</span>}
            </button>
          )
        })}
      </div>
      {visibleArrows.length > 0 && (
        <svg className="board-arrows" viewBox="0 0 800 800" aria-hidden="true">
          <defs><marker id={markerId} markerWidth="2.5" markerHeight="2.5" refX="1.2" refY="1.25" orient="auto"><path d="M0 0 2.5 1.25 0 2.5z" fill="currentColor" /></marker></defs>
          {visibleArrows.map((arrow, index) => {
            const start = center(arrow.from)
            const end = center(arrow.to)
            const angle = Math.atan2(end.y - start.y, end.x - start.x)
            return <line key={`${arrow.from}-${arrow.to}-${index}`} x1={start.x} y1={start.y} x2={end.x - Math.cos(angle) * 19} y2={end.y - Math.sin(angle) * 19} stroke="currentColor" strokeWidth="17" strokeLinecap="round" markerEnd={`url(#${markerId})`} />
          })}
        </svg>
      )}
      {promotion && (
        <div className="board-promotion-backdrop" onKeyDown={event => { if (event.key === 'Escape') setPromotion(null) }}>
          <div className="board-promotion" role="dialog" aria-modal="true" aria-label="Choose a promotion piece">
            <span>Promote pawn</span>
            <div className="board-promotion-options">
              {(['q', 'r', 'b', 'n'] as const).map((type, index) => <button type="button" key={type} autoFocus={index === 0} aria-label={`Promote to ${pieceNames[type]}`} onClick={() => { onMove?.(`${promotion.from}${promotion.to}${type}`); setSelected(null); setPromotion(null) }}><Piece type={type} color={chess.turn()} /></button>)}
            </div>
            <button type="button" className="board-promotion-cancel" onClick={() => setPromotion(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
