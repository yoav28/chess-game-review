import type { EngineLine, Evaluation, PositionAnalysis } from '../engine/types'
import { parsePgn } from './game'
import { createPosition, moveFromUci, positionMoveUci, type ChessVariant } from './position'
import { classificationLabels, type Classification, type GameReview, type MoveReview } from './review'

const labels = Object.keys(classificationLabels) as Classification[]
const phases = ['opening', 'middlegame', 'endgame']
const uci = /^(?:[a-h][1-8][a-h][1-8][qrbn]?|[PNBRQ]@[a-h][1-8])$/
const square = /^[a-h][1-8]$/

function requireValue(condition: unknown, field: string): asserts condition {
  if (!condition) throw new Error(`Invalid review file: ${field}.`)
}

function record(value: unknown, keys: string[], field: string): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), field)
  const result = value as Record<string, unknown>
  requireValue(Object.keys(result).every(key => keys.includes(key)), `${field} contains unsupported fields`)
  return result
}

function text(value: unknown, field: string, max = 8192): asserts value is string {
  requireValue(typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), field)
}

function number(value: unknown, minimum: number, maximum: number, field: string, integer = false): asserts value is number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum && (!integer || Number.isInteger(value)), field)
}

function score(value: unknown, field: string) { if (value !== null) number(value, 0, 100, field) }

export function transferDate(value: unknown, field: string) {
  text(value, field, 32)
  const parsed = Date.parse(value)
  requireValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19), field)
}

function evaluation(value: unknown, field: string): asserts value is Evaluation {
  const data = record(value, ['cp', 'mate'], field)
  number(data.cp, -100000, 100000, `${field} centipawns`, true)
  if (data.mate !== null) number(data.mate, -1000, 1000, `${field} mate`, true)
  requireValue(data.mate !== 0 || data.cp !== 0, `${field} mate winner`)
  requireValue(data.mate === null || data.mate === 0 || (data.mate > 0) === (data.cp > 0), `${field} mate perspective`)
}

function variant(value: unknown, expected: ChessVariant, field: string) {
  requireValue(value === undefined || value === expected, field)
}

function pv(value: unknown, sans: unknown, fen: string, rules: ChessVariant, budget: { remaining: number }, field: string): asserts value is string[] {
  requireValue(Array.isArray(value) && Array.isArray(sans) && value.length === sans.length && value.length <= 256, field)
  budget.remaining -= value.length
  requireValue(budget.remaining >= 0, 'too many engine continuation moves')
  const board = createPosition(fen, rules)
  value.forEach((move, index) => {
    requireValue(typeof move === 'string' && uci.test(move), field)
    const played = moveFromUci(board, move)
    requireValue(positionMoveUci(played) === move && sans[index] === played.san, `${field} legal SAN`)
  })
}

function bestMove(data: Record<string, unknown>, fen: string, rules: ChessVariant, budget: { remaining: number }, field: string) {
  pv(data.pv, data.pvSan, fen, rules, budget, `${field} continuation`)
  if (data.bestMove === null) requireValue(data.bestMoveSan === null && data.pv.length === 0, `${field} missing best move`)
  else {
    requireValue(typeof data.bestMove === 'string' && uci.test(data.bestMove), `${field} best move`)
    const played = moveFromUci(createPosition(fen, rules), data.bestMove)
    requireValue(positionMoveUci(played) === data.bestMove && played.san === data.bestMoveSan && data.pv[0] === data.bestMove, `${field} best move SAN`)
  }
}

function candidateLine(value: unknown, fen: string, rules: ChessVariant, budget: { remaining: number }, field: string): asserts value is EngineLine {
  const line = record(value, ['rank', 'depth', 'evaluation', 'pv', 'pvSan'], field)
  number(line.rank, 1, 5, `${field} rank`, true)
  number(line.depth, 0, 256, `${field} depth`, true)
  evaluation(line.evaluation, `${field} evaluation`)
  pv(line.pv, line.pvSan, fen, rules, budget, `${field} continuation`)
  requireValue(line.pv.length > 0, `${field} is empty`)
}

function analysis(value: unknown, initialFen: string, rules: ChessVariant, budget: { remaining: number }): asserts value is PositionAnalysis {
  const data = record(value, ['variant', 'fen', 'evaluation', 'bestMove', 'bestMoveSan', 'pv', 'pvSan', 'depth', 'lines'], 'initial analysis')
  requireValue(data.fen === initialFen, 'initial analysis position')
  variant(data.variant, rules, 'initial analysis variant')
  evaluation(data.evaluation, 'initial evaluation')
  number(data.depth, 0, 256, 'initial depth', true)
  bestMove(data, initialFen, rules, budget, 'initial analysis')
  requireValue(Array.isArray(data.lines) && data.lines.length <= 5, 'initial candidate lines')
  const ranks = new Set<number>()
  for (const item of data.lines) {
    candidateLine(item, initialFen, rules, budget, 'candidate line')
    requireValue(!ranks.has(item.rank), 'duplicate candidate rank')
    ranks.add(item.rank)
  }
}

const mean = (moves: MoveReview[], color: string) => {
  const own = moves.filter(move => move.color === color)
  return own.length ? Math.round(own.reduce((sum, move) => sum + move.accuracy, 0) / own.length * 10) / 10 : null
}

export function validateTransferredReview(value: unknown): GameReview {
  const data = record(value, ['variant', 'version', 'pgn', 'headers', 'initialFen', 'white', 'black', 'result', 'opening', 'moves', 'whiteAccuracy', 'blackAccuracy', 'phases', 'keyMoments', 'counts', 'initialAnalysis', 'engine', 'accuracyModel', 'accuracyVersion', 'coachMethod', 'analyzedAt', 'importedAt'], 'report')
  requireValue(data.version === 1 && (data.accuracyVersion === undefined || data.accuracyVersion === 2), 'unsupported report or accuracy version')
  text(data.pgn, 'PGN', 1_000_000)
  text(data.initialFen, 'starting FEN', 128)
  const parsed = parsePgn(data.pgn, data.variant as ChessVariant | undefined)
  const rules = parsed.variant ?? 'chess'
  variant(data.variant, rules, 'report variant')
  requireValue(parsed.initialFen === data.initialFen, 'starting FEN does not match PGN')
  text(data.white, 'White player', 256); text(data.black, 'Black player', 256)
  requireValue(data.white === (parsed.headers.White || 'White') && data.black === (parsed.headers.Black || 'Black') && data.result === parsed.result, 'players or result do not match PGN')
  requireValue(data.headers && typeof data.headers === 'object' && !Array.isArray(data.headers), 'headers')
  const headers = data.headers as Record<string, unknown>
  requireValue(Object.keys(headers).length <= 100, 'too many headers')
  for (const [key, content] of Object.entries(headers)) { requireValue(/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key), 'header name'); text(content, 'header value', 4096) }
  const expectedHeaders = { ...parsed.headers, Result: parsed.result }
  requireValue(JSON.stringify(Object.entries(headers).sort()) === JSON.stringify(Object.entries(expectedHeaders).sort()), 'headers do not match PGN')
  for (const key of ['engine', 'accuracyModel'] as const) { text(data[key], key); requireValue(data[key].length > 0, key) }
  if (data.coachMethod !== undefined) text(data.coachMethod, 'coach method')
  transferDate(data.analyzedAt, 'analysis date')
  if (data.importedAt !== undefined) transferDate(data.importedAt, 'previous import date')
  if (data.opening !== null) {
    const opening = record(data.opening, ['name', 'eco'], 'opening')
    text(opening.name, 'opening name', 512)
    requireValue(typeof opening.eco === 'string' && /^[A-E]\d{2}$/.test(opening.eco), 'opening ECO')
  }
  requireValue(Array.isArray(data.moves) && data.moves.length > 0 && data.moves.length <= 2000 && data.moves.length === parsed.moves.length, 'review must contain the complete PGN, up to 2,000 plies')
  const budget = { remaining: 20000 }
  analysis(data.initialAnalysis, parsed.initialFen, rules, budget)
  let previousEvaluation = data.initialAnalysis.evaluation
  const board = createPosition(parsed.initialFen, rules)
  for (const [index, item] of data.moves.entries()) {
    const move = record(item, ['variant', 'ply', 'san', 'uci', 'beforeFen', 'afterFen', 'color', 'piece', 'captured', 'promotion', 'drop', 'from', 'to', 'legalMoves', 'bookName', 'kingTo', 'rookFrom', 'rookTo', 'classification', 'centipawnLoss', 'winningChanceLoss', 'accuracy', 'beforeEvaluation', 'evaluation', 'bestMove', 'bestMoveSan', 'pv', 'pvSan', 'alternativeLine', 'depth', 'phase', 'explanation'], `move ${index + 1}`)
    const original = parsed.moves[index]
    variant(move.variant, rules, 'move variant')
    for (const [key, expected] of Object.entries({ ply: index + 1, san: original.san, uci: original.uci, beforeFen: original.before, afterFen: original.after, color: original.color, piece: original.piece, captured: original.captured, promotion: original.promotion, drop: original.drop, from: original.from, to: original.to })) requireValue(move[key] === expected, `move ${index + 1} ${key} does not match PGN`)
    for (const key of ['kingTo', 'rookFrom', 'rookTo']) {
      if (move[key] !== undefined) requireValue(typeof move[key] === 'string' && square.test(move[key] as string), `castling ${key}`)
    }
    requireValue(move.legalMoves === board.moves().length, 'legal move count')
    const played = board.move(original.san)
    for (const key of ['kingTo', 'rookFrom', 'rookTo'] as const) requireValue(move[key] === played[key], `castling ${key} does not match PGN`)
    requireValue(typeof move.classification === 'string' && labels.includes(move.classification as Classification) && phases.includes(move.phase as string), 'move classification or phase')
    number(move.centipawnLoss, 0, 2000, 'centipawn loss', true)
    if (move.winningChanceLoss !== undefined) number(move.winningChanceLoss, 0, 100, 'winning-chance loss')
    requireValue(data.accuracyVersion !== 2 || move.winningChanceLoss !== undefined, 'v2 winning-chance loss')
    number(move.accuracy, 0, 100, 'move accuracy')
    number(move.depth, 0, 256, 'move depth', true)
    text(move.explanation, 'explanation')
    if (move.bookName !== undefined) text(move.bookName, 'opening line', 512)
    evaluation(move.beforeEvaluation, 'before evaluation'); evaluation(move.evaluation, 'after evaluation')
    requireValue(move.beforeEvaluation.cp === previousEvaluation.cp && move.beforeEvaluation.mate === previousEvaluation.mate, 'evaluation history')
    previousEvaluation = move.evaluation
    bestMove(move, original.before, rules, budget, `move ${index + 1}`)
    if (move.alternativeLine !== undefined) {
      candidateLine(move.alternativeLine, original.before, rules, budget, `move ${index + 1} alternative`)
      requireValue((move.alternativeLine as EngineLine).rank === 2, `move ${index + 1} alternative rank`)
      requireValue((move.alternativeLine as EngineLine).pv[0] !== move.bestMove, `move ${index + 1} alternative repeats best move`)
    }
  }
  const review = data as unknown as GameReview
  score(data.whiteAccuracy, 'White accuracy'); score(data.blackAccuracy, 'Black accuracy')
  requireValue(data.whiteAccuracy === mean(review.moves, 'w') && data.blackAccuracy === mean(review.moves, 'b'), 'overall accuracy does not match move samples')
  const counts = record(data.counts, ['w', 'b'], 'classification counts')
  for (const color of ['w', 'b']) {
    const own = record(counts[color], labels, 'player counts')
    for (const label of labels) requireValue(own[label] === review.moves.filter(move => move.color === color && move.classification === label).length, 'classification count does not match moves')
  }
  requireValue(Array.isArray(data.phases) && data.phases.length <= 3, 'phase summaries')
  const seen = new Set<string>()
  for (const item of data.phases) {
    const phase = record(item, ['phase', 'whiteAccuracy', 'blackAccuracy', 'moves', 'summary'], 'phase summary')
    requireValue(typeof phase.phase === 'string' && phases.includes(phase.phase) && !seen.has(phase.phase), 'duplicate or invalid phase')
    seen.add(phase.phase)
    const moves = review.moves.filter(move => move.phase === phase.phase)
    requireValue(moves.length > 0 && phase.moves === moves.length && phase.whiteAccuracy === mean(moves, 'w') && phase.blackAccuracy === mean(moves, 'b'), 'phase sample counts or accuracy')
    text(phase.summary, 'phase explanation')
  }
  requireValue(new Set(review.moves.map(move => move.phase)).size === seen.size, 'missing phase summary')
  requireValue(Array.isArray(data.keyMoments) && data.keyMoments.length <= review.moves.length && new Set(data.keyMoments).size === data.keyMoments.length, 'key moments')
  for (const ply of data.keyMoments) number(ply, 1, review.moves.length, 'key moment ply', true)
  return review
}
