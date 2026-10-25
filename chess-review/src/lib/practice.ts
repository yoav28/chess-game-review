import type { Color } from 'chess.js'
import { boardWithHistory, terminalEvaluation } from '../engine/protocol'
import { analyzePosition } from '../engine/stockfish'
import type { AnalysisOptions, Evaluation, PositionAnalysis } from '../engine/types'
import type { GameReview, MoveReview } from './review'
import { createPosition, type ChessPosition } from './position'
import { isVariantHeuristic, variantLabel } from './variants'

export type PracticeColor = 'all' | Color
export type PracticeState = {
  practiceIndex: number
  practiceColor: PracticeColor
  practiceStatus: 'thinking' | 'wrong' | 'solved' | 'revealed'
  hint: boolean
  practiceFen: string | null
  retryMoves: MoveReview[]
  retry: MoveReview | undefined
  practiceBusy: boolean
  practiceFeedback: string
}
type Dependencies = { analyze?: typeof analyzePosition; review?: GameReview | null; depth?: number; timeMs?: number }
type AttemptResult = { accepted: boolean; fen: string; san: string; feedback: string }
const errors = new Set(['inaccuracy', 'mistake', 'blunder', 'missed'])
const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/

export const initialPracticeState: PracticeState = {
  practiceIndex: 0, practiceColor: 'all', practiceStatus: 'thinking', hint: false,
  practiceFen: null, retryMoves: [], retry: undefined, practiceBusy: false, practiceFeedback: '',
}

function moveOn(board: ChessPosition, uci: string) {
  if (!uciPattern.test(uci)) throw new Error('Choose a legal move and a promotion piece when needed.')
  return board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
}

export function practiceMoves(review: GameReview | null, color: PracticeColor): MoveReview[] {
  if (!Array.isArray(review?.moves)) return []
  return review.moves.filter(move => {
    if (!move || !errors.has(move.classification) || !['w', 'b'].includes(move.color) || color !== 'all' && move.color !== color
      || typeof move.bestMove !== 'string' || typeof move.beforeFen !== 'string' || !Number.isInteger(move.ply) || move.ply < 1) return false
    try {
      const board = createPosition(move.beforeFen, move.variant ?? review.variant)
      return board.turn() === move.color && Boolean(moveOn(board, move.bestMove))
    } catch { return false }
  })
}

function position(review: GameReview, move: MoveReview) {
  const index = review.moves.indexOf(move)
  if (index < 0) throw new Error('This practice move is no longer in the current review.')
  const moves = review.moves.slice(0, index).map(previous => previous.uci)
  if (moves.some(uci => !uciPattern.test(uci))) throw new Error('The review’s move history is incomplete.')
  const history = { initialFen: review.initialFen, moves }
  const board = boardWithHistory(move.beforeFen, history, review.variant ?? move.variant)
  if (board.turn() !== move.color || board.isGameOver()) throw new Error('This practice position has ended or has the wrong side to move.')
  return { board, history }
}

const evaluationText = ({ cp, mate }: Evaluation, variant?: GameReview['variant']) => mate === 0 ? `${variant && isVariantHeuristic(variant) ? `${variantLabel(variant)} win` : 'checkmate'} (${cp > 0 ? 'White' : 'Black'} wins)`
  : mate !== null ? `${mate > 0 ? 'White' : 'Black'} ${variant && isVariantHeuristic(variant) ? 'wins' : 'mates'} in ${Math.abs(mate)}` : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`
const mateFor = (evaluation: Evaluation, color: Color) => evaluation.mate !== null && evaluation.cp * (color === 'w' ? 1 : -1) > 0
const validEvaluation = (evaluation: Evaluation) => Number.isFinite(evaluation.cp) && (evaluation.mate === null || Number.isFinite(evaluation.mate))
const abortCheck = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Practice analysis cancelled', 'AbortError') }

export async function assessPracticeAttempt(review: GameReview, move: MoveReview, uci: string, options: AnalysisOptions = {}, analyze = analyzePosition): Promise<AttemptResult> {
  abortCheck(options.signal)
  const { board, history } = position(review, move)
  const played = moveOn(board, uci)
  const fen = board.fen()
  if (uci === move.bestMove) return { accepted: true, fen, san: played.san, feedback: `${played.san} matches the saved engine first choice (review depth ${move.depth}).` }
  const depth = Math.max(4, Math.min(24, Math.round(options.depth ?? 16)))
  const timeMs = Math.max(30, Math.min(10000, Math.round(options.timeMs ?? 500)))
  const variant = review.variant ?? move.variant ?? options.variant
  const before = await analyze(move.beforeFen, { depth, timeMs, multiPv: 1, signal: options.signal, history, variant })
  abortCheck(options.signal)
  const after = await analyze(fen, { depth, timeMs, multiPv: 1, signal: options.signal, variant, history: { initialFen: history.initialFen, moves: [...history.moves, uci] } })
  abortCheck(options.signal)
  const evaluation = terminalEvaluation(board) ?? after.evaluation
  if (!validEvaluation(before.evaluation) || !validEvaluation(evaluation) || before.fen !== move.beforeFen || after.fen !== fen) throw new Error('The engine returned an incomplete practice comparison. Try again.')
  let bestSan: string
  try { bestSan = moveOn(createPosition(move.beforeFen, variant), before.bestMove ?? '').san } catch { throw new Error('The engine did not return a legal first choice. Try again.') }
  const loss = Math.max(0, (before.evaluation.cp - evaluation.cp) * (move.color === 'w' ? 1 : -1))
  const preservesMate = !mateFor(before.evaluation, move.color) || mateFor(evaluation, move.color)
  const accepted = loss <= 30 && preservesMate
  const verdict = accepted ? 'preserves the position within the 0.30-pawn practice tolerance'
    : !preservesMate ? `loses the ${variant && isVariantHeuristic(variant) ? 'forced variant-winning line' : 'mating sequence'} found before the move` : 'gives up more than the 0.30-pawn practice tolerance'
  return {
    accepted, fen, san: played.san,
    feedback: `${played.san} ${verdict}. White’s evaluation: ${evaluationText(before.evaluation, variant)} → ${evaluationText(evaluation, variant)}; loss ${Math.min(2000, loss) / 100}${loss > 2000 ? '+' : ''} pawns. Engine first choice: ${bestSan}. Budget: depth ${depth}, ${timeMs} ms per position; reached depths ${before.depth}/${after.depth}. This is a search estimate.`,
  }
}

export function createPracticeReview(onChange: (state: PracticeState) => void, dependencies: Dependencies = {}) {
  const analyze = dependencies.analyze ?? analyzePosition
  let review = dependencies.review ?? null
  let settings = { depth: dependencies.depth ?? 16, timeMs: dependencies.timeMs ?? 500 }
  let live = true
  let active = false
  let request: AbortController | null = null
  let state = { ...initialPracticeState }
  function emit() {
    const retryMoves = practiceMoves(review, state.practiceColor)
    state = { ...state, retryMoves, retry: retryMoves[state.practiceIndex] }
    if (live) onChange(state)
  }
  function cancel() { request?.abort(); request = null }
  function clear() { cancel(); state = { ...state, practiceStatus: 'thinking', practiceFen: null, hint: false, practiceBusy: false, practiceFeedback: '' } }
  function begin(ply?: number, color?: PracticeColor) {
    if (!live) return false
    clear()
    active = true
    const selected = ply === undefined ? undefined : practiceMoves(review, 'all').find(move => move.ply === ply)
    const practiceColor = selected?.color ?? color ?? state.practiceColor
    const retryMoves = practiceMoves(review, practiceColor)
    const index = selected ? retryMoves.indexOf(selected) : 0
    state = { ...state, practiceColor, practiceIndex: Math.max(0, index) }
    emit()
    return Boolean(state.retry)
  }
  return {
    begin,
    setColor: (color: PracticeColor) => { if (live) begin(undefined, color) },
    attempt: async (uci: string) => {
      const move = state.retry
      if (!live || !active || !review || !move || state.practiceBusy || ['solved', 'revealed'].includes(state.practiceStatus)) return
      const currentReview = review
      const controller = new AbortController()
      request = controller
      const owns = () => live && active && request === controller && !controller.signal.aborted && review === currentReview
      state = { ...state, practiceBusy: uci !== move.bestMove, practiceFeedback: '' }
      emit()
      try {
        const result = await assessPracticeAttempt(currentReview, move, uci, { ...settings, signal: controller.signal }, analyze)
        if (!owns()) return
        state = { ...state, practiceStatus: result.accepted ? 'solved' : 'wrong', practiceFen: result.accepted ? result.fen : null, practiceFeedback: result.feedback }
      } catch (error) {
        if (owns()) state = { ...state, practiceStatus: 'wrong', practiceFen: null, practiceFeedback: error instanceof Error ? error.message : 'The engine could not check this attempt. Try again.' }
      } finally {
        if (owns()) { request = null; state = { ...state, practiceBusy: false }; emit() }
      }
    },
    showHint: () => { if (live && active) { state = { ...state, hint: true }; emit() } },
    showSolution: () => {
      if (!live || !active || !review || !state.retry) return
      clear()
      try {
        const { board } = position(review, state.retry)
        const played = moveOn(board, state.retry.bestMove ?? '')
        state = { ...state, practiceStatus: 'revealed', practiceFen: board.fen(), practiceFeedback: `${played.san} was the saved engine first choice at review depth ${state.retry.depth}.` }
      } catch { state = { ...state, practiceFeedback: 'This saved solution is invalid. Review this game again.' } }
      emit()
    },
    next: () => {
      if (!live) return true
      clear()
      const finished = state.practiceIndex + 1 >= practiceMoves(review, state.practiceColor).length
      if (finished) active = false
      else state = { ...state, practiceIndex: state.practiceIndex + 1 }
      emit()
      return finished
    },
    stop: () => { active = false; clear(); emit() },
    reset: () => begin(),
    configure: (nextReview: GameReview | null, depth: number, timeMs: number) => {
      if (review === nextReview && settings.depth === depth && settings.timeMs === timeMs) return
      clear()
      if (review !== nextReview) { active = false; state = { ...state, practiceIndex: 0 } }
      review = nextReview
      settings = { depth, timeMs }
      emit()
    },
    activate: () => { live = true; emit() },
    dispose: () => { live = false; active = false; clear() },
  }
}
