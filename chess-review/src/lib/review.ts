import { Chess, type Color, type Move } from 'chess.js'
import { StockfishEngine } from '../engine/stockfish'
import { terminalEvaluation } from '../engine/protocol'
import type { Evaluation, PositionAnalysis, ReviewOptions } from '../engine/types'
import { openingForMoves, type Opening } from './openings'
import { isSoundSacrifice, isUniqueOpportunity } from './review-metrics'
import { insightMethod, insightsForMove } from './insights'

export type Classification = 'brilliant' | 'great' | 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'missed' | 'forced'
export type GamePhase = 'opening' | 'middlegame' | 'endgame'

export type ParsedMove = {
  ply: number
  san: string
  uci: string
  beforeFen: string
  afterFen: string
  color: Color
  piece: string
  captured?: string
  promotion?: string
  from: string
  to: string
  legalMoves: number
  bookName?: string
}

export type ParsedGame = {
  pgn: string
  headers: Record<string, string>
  initialFen: string
  moves: ParsedMove[]
}

export type MoveReview = ParsedMove & {
  classification: Classification
  centipawnLoss: number
  accuracy: number
  beforeEvaluation: Evaluation
  evaluation: Evaluation
  bestMove: string | null
  bestMoveSan: string | null
  pv: string[]
  pvSan: string[]
  depth: number
  phase: GamePhase
  explanation: string
}

export type PhaseSummary = {
  phase: GamePhase
  whiteAccuracy: number | null
  blackAccuracy: number | null
  moves: number
  summary: string
}

export type GameReview = {
  version: 1
  pgn: string
  headers: Record<string, string>
  initialFen: string
  white: string
  black: string
  result: string
  opening: Opening | null
  moves: MoveReview[]
  whiteAccuracy: number | null
  blackAccuracy: number | null
  phases: PhaseSummary[]
  keyMoments: number[]
  counts: Record<Color, Record<Classification, number>>
  initialAnalysis: PositionAnalysis
  engine: string
  accuracyModel: string
  coachMethod?: string
  analyzedAt: string
}

export const classificationLabels: Record<Classification, string> = {
  brilliant: 'Brilliant', great: 'Great', book: 'Book',
  best: 'Best', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy',
  mistake: 'Mistake', blunder: 'Blunder', missed: 'Missed opportunity', forced: 'Forced',
}

export function parsePgn(pgn: string): ParsedGame {
  const board = new Chess()
  try {
    board.loadPgn(pgn)
  } catch {
    throw new Error('This PGN could not be read. Check that it contains a valid chess game.')
  }
  const headers = board.getHeaders()
  const history = board.history({ verbose: true })
  const initialFen = history[0]?.before ?? board.fen()
  const replay = new Chess(initialFen)
  const sans: string[] = []
  const moves = history.map((move: Move, index: number) => {
    const legalMoves = replay.moves().length
    replay.move(move.san)
    sans.push(move.san)
    const opening = initialFen === new Chess().fen() ? openingForMoves(sans) : null
    return {
      ply: index + 1, san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ''}`,
      beforeFen: move.before, afterFen: move.after, color: move.color, piece: move.piece,
      captured: move.captured, promotion: move.promotion, from: move.from, to: move.to, legalMoves,
      bookName: opening?.book ? opening.opening?.name ?? 'Opening book line' : undefined,
    }
  })
  return { pgn, headers, initialFen, moves }
}

export function moveAccuracy(centipawnLoss: number): number {
  return Math.round(100 * Math.exp(-Math.max(0, centipawnLoss) / 250) * 10) / 10
}

export function classifyMove(move: ParsedMove, before: PositionAnalysis, after: PositionAnalysis): { classification: Classification; centipawnLoss: number } {
  const direction = move.color === 'w' ? 1 : -1
  const best = move.uci === before.bestMove
  const previousScore = before.evaluation.cp * direction
  const currentScore = after.evaluation.cp * direction
  const centipawnLoss = best ? 0 : Math.round(Math.max(0, Math.min(2000, previousScore - currentScore)))
  if (move.legalMoves === 1) return { classification: 'forced', centipawnLoss: 0 }
  if (move.bookName) return { classification: 'book', centipawnLoss }
  if (isSoundSacrifice(move, before, after)) return { classification: 'brilliant', centipawnLoss }
  if (isUniqueOpportunity(move, before)) return { classification: 'great', centipawnLoss }
  if (best) return { classification: 'best', centipawnLoss }
  const hadMate = before.evaluation.mate !== null && previousScore > 0
  const keepsMate = after.evaluation.mate !== null && currentScore > 0
  if (hadMate && !keepsMate) return { classification: 'missed', centipawnLoss }
  if (centipawnLoss <= 20) return { classification: 'excellent', centipawnLoss }
  if (centipawnLoss <= 60) return { classification: 'good', centipawnLoss }
  if (centipawnLoss <= 120) return { classification: 'inaccuracy', centipawnLoss }
  if (previousScore >= 150 && currentScore < 50 && centipawnLoss >= 200) return { classification: 'missed', centipawnLoss }
  if (centipawnLoss <= 250) return { classification: 'mistake', centipawnLoss }
  return { classification: 'blunder', centipawnLoss }
}

export function gamePhase(fen: string, ply: number): GamePhase {
  const board = new Chess(fen)
  const pieces = board.board().flat().filter(piece => piece !== null)
  const queens = pieces.filter(piece => piece.type === 'q').length
  const material = pieces.reduce((sum, piece) => sum + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[piece.type]), 0)
  if (material <= 20 || (queens === 0 && material <= 32)) return 'endgame'
  return ply <= 20 ? 'opening' : 'middlegame'
}

function evaluationText(evaluation: Evaluation): string {
  if (evaluation.mate === 0) return 'Checkmate ends the game.'
  if (evaluation.mate !== null) return `${evaluation.mate > 0 ? 'White' : 'Black'} has a forced mate in ${Math.abs(evaluation.mate)} with best play.`
  const score = Math.abs(evaluation.cp)
  if (score < 35) return 'The engine evaluates the position as roughly equal.'
  return `${evaluation.cp > 0 ? 'White' : 'Black'} has ${score < 100 ? 'a small edge' : score < 250 ? 'an advantage' : 'a winning advantage'} (${(score / 100).toFixed(2)} pawns).`
}

export function explainMove(move: ParsedMove, classification: Classification, before: PositionAnalysis, after: PositionAnalysis): string {
  const names: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
  let action = `${move.san} moves the ${names[move.piece]} from ${move.from} to ${move.to}.`
  if (move.captured) action = `${move.san} captures ${move.captured === 'p' ? 'a pawn' : `the ${names[move.captured]}`} on ${move.to}.`
  if (move.san.startsWith('O-O')) action = `${move.san} castles ${move.san.startsWith('O-O-O') ? 'queenside' : 'kingside'}, moving the king and rook.`
  if (move.promotion) action += ` The pawn promotes to a ${names[move.promotion]}.`
  if (move.san.endsWith('+')) action += ' It gives check.'
  const alternative = before.bestMoveSan && move.uci !== before.bestMove
    ? ` ${before.bestMoveSan} was the engine's first choice${before.pvSan.length > 1 ? `; one best-play continuation is ${before.pvSan.slice(0, 5).join(' ')}` : ''}.`
    : classification === 'forced' ? ' This was the only legal move.' : ' This matches the engine’s first choice.'
  const lesson = {
    brilliant: ' The engine’s best reply captures the sacrificed piece, while its evaluation still favors you; this is a sacrifice heuristic.',
    great: ' This is the only top-two engine candidate that preserves an even position or a winning advantage at this search depth.',
    book: ` This follows a verified line in the small local opening book (${move.bookName}).`,
    best: '', forced: '', excellent: ' This keeps nearly all of the position’s value.', good: ' This gives up a small amount of the position’s value.',
    inaccuracy: ' A more accurate move would preserve more of the position’s value.',
    mistake: ' This gives the opponent a significantly better position.', blunder: ' This sharply changes the evaluation in the opponent’s favor.',
    missed: before.evaluation.mate !== null && before.evaluation.cp * (move.color === 'w' ? 1 : -1) > 0
      ? ' The mating sequence found before this move is no longer found afterward.'
      : ' This lets a winning opportunity slip away.',
  }[classification]
  const insights = insightsForMove(move)
  const describe = () => `${action}${insights.length ? ` ${insights.join(' ')}` : ''}${lesson}${alternative} ${evaluationText(after.evaluation)}`
  while (insights.length && describe().length > 720) insights.pop()
  return describe()
}

function average(moves: MoveReview[], color: Color): number | null {
  const selected = moves.filter(move => move.color === color)
  return selected.length ? Math.round(selected.reduce((sum, move) => sum + move.accuracy, 0) / selected.length * 10) / 10 : null
}

export function buildReview(game: ParsedGame, positions: PositionAnalysis[]): GameReview {
  if (positions.length !== game.moves.length + 1) throw new Error('The game analysis is incomplete.')
  const moves: MoveReview[] = game.moves.map((move, index) => {
    const before = positions[index]
    const after = positions[index + 1]
    const assessed = classifyMove(move, before, after)
    return {
      ...move, ...assessed, accuracy: moveAccuracy(assessed.centipawnLoss), beforeEvaluation: before.evaluation,
      evaluation: after.evaluation, bestMove: before.bestMove, bestMoveSan: before.bestMoveSan,
      pv: before.pv, pvSan: before.pvSan, depth: Math.min(before.depth, after.depth || before.depth),
      phase: gamePhase(move.beforeFen, move.ply), explanation: explainMove(move, assessed.classification, before, after),
    }
  })
  const emptyCounts = () => Object.fromEntries(Object.keys(classificationLabels).map(key => [key, 0])) as Record<Classification, number>
  const counts = { w: emptyCounts(), b: emptyCounts() }
  moves.forEach(move => counts[move.color][move.classification]++)
  const phases: PhaseSummary[] = (['opening', 'middlegame', 'endgame'] as GamePhase[]).flatMap(phase => {
    const selected = moves.filter(move => move.phase === phase)
    if (!selected.length) return []
    const biggest = [...selected].sort((a, b) => b.centipawnLoss - a.centipawnLoss)[0]
    return [{
      phase, moves: selected.length, whiteAccuracy: average(selected, 'w'), blackAccuracy: average(selected, 'b'),
      summary: biggest.centipawnLoss > 120
        ? `The largest opportunity to improve was ${biggest.beforeFen.split(' ')[5]}${biggest.color === 'w' ? '.' : '...'} ${biggest.san}; ${biggest.bestMoveSan ?? 'the engine alternative'} preserved more value.`
        : 'Both sides generally preserved the engine evaluation in this phase.',
    }]
  })
  const keyMoments = [...moves].filter(move => move.centipawnLoss > 60).sort((a, b) => b.centipawnLoss - a.centipawnLoss).slice(0, 8).map(move => move.ply).sort((a, b) => a - b)
  return {
    version: 1, pgn: game.pgn, headers: game.headers, initialFen: game.initialFen,
    white: game.headers.White || 'White', black: game.headers.Black || 'Black', result: game.headers.Result || '*',
    opening: game.initialFen === new Chess().fen() ? openingForMoves(game.moves.map(move => move.san)).opening : null,
    moves, whiteAccuracy: average(moves, 'w'), blackAccuracy: average(moves, 'b'), phases, keyMoments, counts,
    initialAnalysis: positions[0], engine: 'Stockfish 19 lite · single thread',
    accuracyModel: 'Independent metric: each move scores 100 × exp(−centipawn loss / 250); the game score is the mean. Brilliant means a best move with a material sacrifice and a favorable engine evaluation; Great means only the best of two candidates preserves equality or a win. These are depth-dependent heuristics. Book matches a small local registry, not a complete opening database.',
    coachMethod: insightMethod,
    analyzedAt: new Date().toISOString(),
  }
}

export async function reviewGame(pgn: string, options: ReviewOptions = {}): Promise<GameReview> {
  const game = parsePgn(pgn)
  if (!game.moves.length) throw new Error('This game has no moves to review.')
  const engine = new StockfishEngine(options.signal)
  const positions: PositionAnalysis[] = []
  const total = game.moves.length + 1
  const replay = new Chess(game.initialFen)
  try {
    options.onProgress?.({ completed: 0, total, percent: 0 })
    for (let index = 0; index < total; index++) {
      if (options.signal?.aborted) throw new DOMException('Analysis cancelled', 'AbortError')
      if (index > 0) replay.move(game.moves[index - 1].san)
      const analysis = await engine.analyze(replay.fen(), { ...options, multiPv: 2, history: { initialFen: game.initialFen, moves: game.moves.slice(0, index).map(move => move.uci) } })
      const terminal = terminalEvaluation(replay)
      positions.push(terminal ? { ...analysis, evaluation: terminal } : analysis)
      options.onProgress?.({ completed: index + 1, total, percent: Math.round((index + 1) / total * 100) })
    }
    return buildReview(game, positions)
  } finally {
    engine.dispose()
  }
}
