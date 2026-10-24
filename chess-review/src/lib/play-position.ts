import type { Color } from 'chess.js'
import { createPosition, positionMoveUci, resolveVariant, type ChessPosition, type ChessVariant } from './position'
import { boardWithHistory } from '../engine/protocol'
import { analyzePosition } from '../engine/stockfish'
import type { AnalysisOptions } from '../engine/types'

export type PositionHistory = NonNullable<AnalysisOptions['history']>
export type PlayPositionState = {
  variant?: ChessVariant
  active: boolean
  fen: string
  historySans: string[]
  thinking: boolean
  error: string
  outcome: string | null
  playerColor: Color
  turn: Color
  canUndo: boolean
  lastMove: { from: string; to: string } | null
}

export const initialPlayPositionState: PlayPositionState = {
  active: false, variant: 'chess', fen: createPosition().fen(), historySans: [], thinking: false,
  error: '', outcome: null, playerColor: 'w', turn: 'w', canUndo: false, lastMove: null,
}

type Dependencies = {
  analyze?: typeof analyzePosition
  depth?: number
  timeMs?: number
}

export function positionOutcome(board: ChessPosition): string | null {
  if (board.isCheckmate()) return (board.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate.'
  if (board.isStalemate()) return 'Draw by stalemate.'
  if (board.isInsufficientMaterial()) return 'Draw by insufficient material.'
  if (board.isThreefoldRepetition()) return 'Draw by threefold repetition.'
  if (board.isDrawByFiftyMoves()) return 'Draw by the fifty-move rule.'
  return board.isDraw() ? 'Draw.' : null
}

export function createPlayPosition(onChange: (state: PlayPositionState) => void, dependencies: Dependencies = {}) {
  const analyze = dependencies.analyze ?? analyzePosition
  let settings = { depth: dependencies.depth ?? 16, timeMs: dependencies.timeMs ?? 500 }
  let live = true
  let board: ChessPosition | null = null
  let base: { fen: string; history: PositionHistory; variant: ChessVariant } | null = null
  let userMoves: number[] = []
  let request: AbortController | null = null
  let state = { ...initialPlayPositionState }

  function emit() {
    const moves = board?.history({ verbose: true }) ?? []
    const continuation = moves.slice(base?.history.moves.length ?? 0)
    const last = continuation.at(-1)
    state = {
      ...state,
      fen: board?.fen() ?? state.fen,
      turn: board?.turn() ?? state.turn,
      historySans: continuation.map(move => move.san),
      outcome: board ? positionOutcome(board) : null,
      canUndo: userMoves.length > 0,
      lastMove: last ? { from: last.from, to: last.kingTo ?? last.to } : null,
    }
    if (live) onChange(state)
  }

  function abort() {
    request?.abort()
    request = null
    state = { ...state, thinking: false }
  }

  async function engineTurn() {
    if (!live || !state.active || !board || positionOutcome(board) || board.turn() === state.playerColor || request) return
    const currentBoard = board
    const controller = new AbortController()
    request = controller
    const owns = () => live && state.active && request === controller && !controller.signal.aborted && board === currentBoard
    const history = currentBoard.history({ verbose: true }).map(positionMoveUci)
    state = { ...state, thinking: true, error: '' }
    emit()
    try {
      const result = await analyze(currentBoard.fen(), {
        ...settings, variant: base!.variant, multiPv: 1, signal: controller.signal,
        history: { initialFen: base!.history.initialFen, moves: history },
      })
      if (!owns()) return
      if (!result.bestMove || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(result.bestMove)) throw new Error('The engine did not return a legal reply. Try again.')
      const uci = result.bestMove
      currentBoard.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    } catch (error) {
      if (owns()) state = { ...state, error: error instanceof Error ? error.message : 'The engine could not play this position.' }
    } finally {
      if (owns()) {
        request = null
        state = { ...state, thinking: false }
        emit()
      }
    }
  }

  function start(fen: string, playerColor: Color, history?: PositionHistory, variant?: ChessVariant): boolean {
    if (!live) return false
    abort()
    try {
      const rules = resolveVariant(history?.initialFen ?? fen, variant)
      board = boardWithHistory(fen, history, rules)
      base = {
        fen: board.fen(),
        variant: rules,
        history: history ? { initialFen: history.initialFen, moves: [...history.moves] } : { initialFen: board.fen(), moves: [] },
      }
      userMoves = []
      state = { ...initialPlayPositionState, variant: rules, active: true, playerColor }
      emit()
      void engineTurn()
      return true
    } catch (error) {
      board = null
      base = null
      userMoves = []
      state = { ...initialPlayPositionState, error: error instanceof Error ? error.message : 'This position is invalid.' }
      emit()
      return false
    }
  }

  return {
    start,
    move: (uci: string): boolean => {
      if (!live || !state.active || !board || state.thinking || positionOutcome(board) || board.turn() !== state.playerColor) return false
      try {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Choose a legal move and a promotion piece when needed.')
        board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
        userMoves.push(board.history().length)
        state = { ...state, error: '' }
        emit()
        void engineTurn()
        return true
      } catch {
        state = { ...state, error: 'That move is not legal in this position. Choose a promotion piece when needed.' }
        emit()
        return false
      }
    },
    undo: (): boolean => {
      if (!live || !state.active || !board || !userMoves.length) return false
      abort()
      const ply = userMoves.pop()!
      while (board.history().length >= ply) board.undo()
      state = { ...state, error: '' }
      emit()
      void engineTurn()
      return true
    },
    restart: () => {
      if (base) start(base.fen, state.playerColor, base.history, base.variant)
    },
    stop: () => {
      abort()
      state = { ...state, active: false }
      emit()
    },
    setPlayerColor: (color: Color) => {
      if (!live || color === state.playerColor) return
      abort()
      state = { ...state, playerColor: color, error: '' }
      emit()
      void engineTurn()
    },
    retry: () => { void engineTurn() },
    configure: (depth: number, timeMs: number) => {
      if (settings.depth === depth && settings.timeMs === timeMs) return
      settings = { depth, timeMs }
      if (request) {
        abort()
        void engineTurn()
      }
    },
    activate: () => { live = true; void engineTurn() },
    dispose: () => { live = false; abort() },
  }
}
