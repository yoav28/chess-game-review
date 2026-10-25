import type { Color, Square } from 'chess.js'
import { winningChance } from './accuracy'
import { createPosition } from './position'
import type { GameReview, MoveReview } from './review'
import { insightsForMove } from './insights'

export const skillTabs = [
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'openings', label: 'Openings' },
  { key: 'tactics', label: 'Tactics' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'endgames', label: 'Endgames' },
] as const

export type SkillTab = typeof skillTabs[number]['key']
export type SkillTheme = {
  key: string
  label: string
  description: string
  plies: Record<Color, number[]>
}
export type SkillThemeGroup = { key: SkillTab; label: string; themes: SkillTheme[] }

const colors: Color[] = ['w', 'b']
const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 }
const centerFiles = new Set(['c', 'd', 'e', 'f'])
const wingFiles = new Set(['a', 'b', 'c', 'f', 'g', 'h'])

function connectedRooks(move: MoveReview): boolean {
  const board = createPosition(move.afterFen, move.variant)
  const rooks = board.board().flat().filter(piece => piece?.color === move.color && piece.type === 'r')
  for (let left = 0; left < rooks.length; left++) for (let right = left + 1; right < rooks.length; right++) {
    const a = rooks[left]!, b = rooks[right]!
    if (a.square[0] !== b.square[0] && a.square[1] !== b.square[1]) continue
    const from = a.square[0] === b.square[0] ? Number(a.square[1]) : a.square[0].charCodeAt(0)
    const to = a.square[0] === b.square[0] ? Number(b.square[1]) : b.square[0].charCodeAt(0)
    const file = a.square[0] === b.square[0]
    let clear = true
    for (let value = Math.min(from, to) + 1; value < Math.max(from, to); value++) {
      const square = file ? `${a.square[0]}${value}` : `${String.fromCharCode(value)}${a.square[1]}`
      if (board.get(square as Square)) { clear = false; break }
    }
    if (clear) return true
  }
  return false
}

function doubleCheck(move: MoveReview): boolean {
  const board = createPosition(move.afterFen, move.variant)
  const king = board.board().flat().find(piece => piece?.color !== move.color && piece?.type === 'k')
  return Boolean(king && board.isCheck() && board.attackers(king.square, move.color).length > 1)
}

function isPassedPawnMove(move: MoveReview): boolean {
  if (move.piece !== 'p') return false
  const board = createPosition(move.beforeFen, move.variant)
  const destinationRank = Number(move.to[1])
  const enemy = move.color === 'w' ? 'b' : 'w'
  return !board.board().flat().some(piece => piece?.type === 'p' && piece.color === enemy
    && Math.abs(piece.square.charCodeAt(0) - move.to.charCodeAt(0)) <= 1
    && (move.color === 'w' ? Number(piece.square[1]) > Number(move.from[1]) : Number(piece.square[1]) < Number(move.from[1])))
    && Number.isFinite(destinationRank)
}

function outpost(move: MoveReview): boolean {
  if (move.piece !== 'n' && move.piece !== 'b') return false
  const rank = Number(move.to[1])
  if (move.color === 'w' ? rank < 4 : rank > 5) return false
  const board = createPosition(move.afterFen, move.variant)
  const target = move.to as Square
  const defenders = board.attackers(target, move.color)
  const pawnDefended = defenders.some(square => board.get(square)?.type === 'p')
  const enemyPawnCanChallenge = board.attackers(target, move.color === 'w' ? 'b' : 'w').some(square => board.get(square)?.type === 'p')
  return pawnDefended && !enemyPawnCanChallenge
}

function defendsAttackedPiece(move: MoveReview): boolean {
  const before = createPosition(move.beforeFen, move.variant)
  const after = createPosition(move.afterFen, move.variant)
  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  return before.board().flat().some(piece => piece?.color === move.color && piece.square !== move.from
    && before.isAttacked(piece.square, enemy) && after.get(piece.square)?.color === move.color
    && after.attackers(piece.square, move.color).includes(move.to as Square))
}

function discoveredAttack(move: MoveReview): boolean {
  const before = createPosition(move.beforeFen, move.variant)
  const after = createPosition(move.afterFen, move.variant)
  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  const previousAttackers = (square: Square) => new Set(before.attackers(square, move.color))
  return after.board().flat().some(target => {
    if (target?.color !== enemy || target.type === 'k') return false
    const oldAttackers = previousAttackers(target.square)
    return after.attackers(target.square, move.color).some(square => square !== move.to && !oldAttackers.has(square))
  })
}

function removesDefender(move: MoveReview): boolean {
  if (!move.captured) return false
  const before = createPosition(move.beforeFen, move.variant)
  const after = createPosition(move.afterFen, move.variant)
  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  return before.board().flat().some(target => {
    if (target?.color !== enemy || target.type === 'k' || target.type === 'p' || !after.get(target.square)) return false
    return before.attackers(target.square, enemy).length > after.attackers(target.square, enemy).length
  })
}

function equalTrade(move: MoveReview, index: number, moves: MoveReview[]): boolean {
  if (!move.captured || index === 0) return false
  const previous = moves[index - 1]
  return Boolean(previous.captured && previous.to === move.to
    && pieceValues[previous.captured] === pieceValues[move.captured])
}

function winsTempo(move: MoveReview): boolean {
  const before = createPosition(move.beforeFen, move.variant)
  const after = createPosition(move.afterFen, move.variant)
  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  return after.board().flat().some(target => target?.color === enemy && target.type !== 'k'
    && pieceValues[target.type] > pieceValues[move.piece]
    && after.attackers(target.square, move.color).includes(move.to as Square)
    && !before.attackers(target.square, move.color).includes(move.from as Square))
}

function passedPawnProtected(move: MoveReview): boolean {
  if (!isPassedPawnMove(move)) return false
  const board = createPosition(move.afterFen, move.variant)
  return board.attackers(move.to as Square, move.color).length > 0
}

function protectedRookBehindPassedPawn(move: MoveReview): boolean {
  const board = createPosition(move.afterFen, move.variant)
  const pieces = board.board().flat().filter(piece => piece !== null)
  const rooks = pieces.filter(piece => piece.color === move.color && piece.type === 'r')
  const pawns = pieces.filter(piece => piece.color === move.color && piece.type === 'p')
  const enemyPawns = pieces.filter(piece => piece.color !== move.color && piece.type === 'p')
  return rooks.some(rook => pawns.some(pawn => {
    const forward = move.color === 'w' ? 1 : -1
    const ahead = (Number(pawn.square[1]) - Number(rook.square[1])) * forward > 0 && pawn.square[0] === rook.square[0]
    const passed = !enemyPawns.some(enemy => Math.abs(enemy.square.charCodeAt(0) - pawn.square.charCodeAt(0)) <= 1
      && (Number(enemy.square[1]) - Number(pawn.square[1])) * forward > 0)
    return ahead && passed
  }))
}

function materialTheme(move: MoveReview, theme: 'king-pawn' | 'queen' | 'rook' | 'knight-bishop'): boolean {
  const pieces = createPosition(move.afterFen, move.variant).board().flat().filter((piece): piece is NonNullable<typeof piece> => piece !== null && piece.type !== 'k')
  if (theme === 'king-pawn') return pieces.some(piece => piece.type === 'p') && pieces.every(piece => piece.type === 'p')
  if (theme === 'queen') return pieces.some(piece => piece.type === 'q') && pieces.every(piece => piece.type === 'q' || piece.type === 'p')
  if (theme === 'knight-bishop') return pieces.some(piece => piece.type === 'n' || piece.type === 'b') && pieces.every(piece => ['p', 'n', 'b'].includes(piece.type))
  return pieces.some(piece => piece.type === 'r') && pieces.every(piece => piece.type === 'r' || piece.type === 'p')
}

function checkmateMove(move: MoveReview): boolean {
  return move.san.endsWith('#') && move.variant !== 'giveaway' && move.variant !== 'racingkings'
}

function backrankMate(move: MoveReview): boolean {
  if (!checkmateMove(move)) return false
  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  const king = createPosition(move.afterFen, move.variant).board().flat().find(piece => piece?.color === enemy && piece.type === 'k')
  return Boolean(king && (king.square[1] === '1' || king.square[1] === '8'))
}

function rookSupportsPassedPawn(move: MoveReview): boolean {
  if (move.piece !== 'r') return false
  const board = createPosition(move.afterFen, move.variant)
  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  const pieces = board.board().flat().filter(piece => piece !== null)
  const rooks = pieces.filter(piece => piece.color === move.color && piece.type === 'r')
  const pawns = pieces.filter(piece => piece.color === move.color && piece.type === 'p')
  const enemyPawns = pieces.filter(piece => piece.color === enemy && piece.type === 'p')
  return rooks.some(rook => pawns.some(pawn => pawn.square[0] === rook.square[0]
    && (move.color === 'w' ? Number(pawn.square[1]) > Number(rook.square[1]) : Number(pawn.square[1]) < Number(rook.square[1]))
    && !enemyPawns.some(enemyPawn => Math.abs(enemyPawn.square.charCodeAt(0) - pawn.square.charCodeAt(0)) <= 1
      && (move.color === 'w' ? Number(enemyPawn.square[1]) > Number(pawn.square[1]) : Number(enemyPawn.square[1]) < Number(pawn.square[1])))))
}

function opposition(move: MoveReview): boolean {
  const board = createPosition(move.afterFen, move.variant)
  const kings = board.board().flat().filter(piece => piece?.type === 'k')
  if (kings.length !== 2) return false
  const [white, black] = kings
  const sameFile = white!.square[0] === black!.square[0] && Math.abs(Number(white!.square[1]) - Number(black!.square[1])) === 2
  const sameRank = white!.square[1] === black!.square[1] && Math.abs(white!.square.charCodeAt(0) - black!.square.charCodeAt(0)) === 2
  if (!sameFile && !sameRank) return false
  const file = sameFile ? white!.square[0] : String.fromCharCode((white!.square.charCodeAt(0) + black!.square.charCodeAt(0)) / 2)
  const rank = sameFile ? String((Number(white!.square[1]) + Number(black!.square[1])) / 2) : white!.square[1]
  return !board.get(file + rank as Square)
}

type Detection = { key: string; label: string; description: string; matches: (move: MoveReview, index: number, moves: MoveReview[], insights: string[]) => boolean }

const detections: Record<SkillTab, Detection[]> = {
  fundamentals: [
    { key: 'captures', label: 'Captures', description: 'Recorded moves that capture a piece.', matches: move => Boolean(move.captured) },
    { key: 'checks', label: 'Checks', description: 'Recorded moves that give check under the active rules.', matches: (move, _, __, insights) => /check|checkmate/i.test(move.san) || insights.some(text => /delivered .*checks?/i.test(text)) },
    { key: 'castles', label: 'Castles', description: 'Recorded king-side or queen-side castling.', matches: move => move.san.startsWith('O-O') },
    { key: 'checkmates', label: 'Checkmates', description: 'Recorded checkmate moves under the active rules.', matches: move => checkmateMove(move) },
    { key: 'free-pieces', label: 'Free pieces', description: 'Moves after which the moved piece has no direct defender against a legal capture.', matches: (_, __, ___, insights) => insights.some(text => /can be captured and has no direct defender/.test(text)) },
    { key: 'defends-pieces', label: 'Defends pieces', description: 'A moved piece defends a friendly piece that was under attack.', matches: move => defendsAttackedPiece(move) },
    { key: 'retreats', label: 'Retreats', description: 'Non-pawn moves back toward the mover’s home rank.', matches: move => move.piece !== 'p' && (move.color === 'w' ? Number(move.to[1]) < Number(move.from[1]) : Number(move.to[1]) > Number(move.from[1])) },
  ],
  openings: [
    { key: 'develops-pieces', label: 'Develops pieces', description: 'A knight or bishop leaves its home rank in the opening.', matches: move => move.phase === 'opening' && ['n', 'b'].includes(move.piece) && (move.color === 'w' ? move.from[1] === '1' && move.to[1] !== '1' : move.from[1] === '8' && move.to[1] !== '8') },
    { key: 'pawns-in-center', label: 'Pawns in center', description: 'An opening pawn move reaches the central d- or e-file.', matches: move => move.phase === 'opening' && move.piece === 'p' && ['d', 'e'].includes(move.to[0]) },
    { key: 'strikes-at-center', label: 'Strikes at center', description: 'The move adds control of a central square.', matches: (_, __, ___, insights) => insights.some(text => /control of .* in the center/.test(text)) },
    { key: 'connects-rooks', label: 'Connects rooks', description: 'The move leaves both rooks on an open shared rank or file.', matches: move => move.phase === 'opening' && connectedRooks(move) },
    { key: 'completes-development', label: 'Completes development', description: 'The move develops the last knight or bishop from the home rank.', matches: move => {
      if (move.phase !== 'opening' || !['n', 'b'].includes(move.piece)) return false
      const board = createPosition(move.afterFen, move.variant)
      const home = move.color === 'w' ? '1' : '8'
      return !board.board().flat().some(piece => piece?.color === move.color && ['n', 'b'].includes(piece.type) && piece.square[1] === home)
    } },
    { key: 'book-moves', label: 'Book moves', description: 'The move matches a registered opening-book prefix.', matches: move => move.classification === 'book' },
    { key: 'fianchettos', label: 'Fianchettos', description: 'A bishop develops to a standard fianchetto square.', matches: move => move.piece === 'b' && ['b2', 'g2', 'b7', 'g7'].includes(move.to) },
  ],
  tactics: [
    { key: 'recaptures', label: 'Recaptures', description: 'A capture immediately returns to the square of the previous capture.', matches: (move, index, moves) => Boolean(move.captured && index > 0 && moves[index - 1].captured && moves[index - 1].to === move.to) },
    { key: 'winning-captures', label: 'Winning captures', description: 'A capture improves the mover-relative engine winning chance.', matches: move => Boolean(move.captured && winningChance(move.evaluation, move.color) > winningChance(move.beforeEvaluation, move.color)) },
    { key: 'forks', label: 'Forks', description: 'The coach found pressure against at least two valuable targets.', matches: (_, __, ___, insights) => insights.some(text => /creating fork pressure/.test(text)) },
    { key: 'knight-forks', label: 'Knight forks', description: 'A knight move creates fork pressure.', matches: (move, _, __, insights) => move.piece === 'n' && insights.some(text => /creating fork pressure/.test(text)) },
    { key: 'pins', label: 'Pins', description: 'The coach identified a new pin in the position.', matches: (_, __, ___, insights) => insights.some(text => / pins the /.test(text)) },
    { key: 'discovered-attacks', label: 'Discovered attacks', description: 'A line piece gains an attack because another piece moved away from its line.', matches: move => discoveredAttack(move) },
    { key: 'removes-defenders', label: 'Removes defenders', description: 'A capture reduces the number of defenders around another valuable enemy piece.', matches: move => removesDefender(move) },
    { key: 'en-passant', label: 'En passant', description: 'A pawn captures diagonally onto an empty square.', matches: move => move.piece === 'p' && move.captured === 'p' && move.from[0] !== move.to[0] && !createPosition(move.beforeFen, move.variant).get(move.to as Square) },
    { key: 'double-checks', label: 'Double checks', description: 'The move attacks the opposing king with at least two pieces.', matches: (move, _, __, ___) => doubleCheck(move) },
    { key: 'brilliant-sacrifices', label: 'Brilliant sacrifices', description: 'The independent review classified the move as Brilliant.', matches: move => move.classification === 'brilliant' },
    { key: 'queen-sacrifices', label: 'Queen sacrifices', description: 'The queen is captured on the opponent’s next move.', matches: (move, index, moves) => move.piece === 'q' && moves[index + 1]?.captured === 'q' },
    { key: 'backrank-mates', label: 'Back-rank mates', description: 'A checkmate leaves the opposing king on its home rank.', matches: move => backrankMate(move) },
  ],
  strategy: [
    { key: 'rooks-to-open-files', label: 'Rooks to open files', description: 'The coach identified a rook on an open or semi-open file.', matches: (_, __, ___, insights) => insights.some(text => /rook occupies the .*file/.test(text)) },
    { key: 'outposts', label: 'Outposts', description: 'A knight or bishop reaches an advanced square protected by a pawn and not challengeable by an enemy pawn.', matches: move => outpost(move) },
    { key: 'doubles-rooks', label: 'Doubles rooks', description: 'The move connects the mover’s rooks on a clear rank or file.', matches: move => connectedRooks(move) },
    { key: 'equal-trades', label: 'Equal trades', description: 'A capture is immediately recaptured with equal-value pieces.', matches: (move, index, moves) => equalTrade(move, index, moves) },
    { key: 'wins-tempo', label: 'Wins tempo', description: 'The moved piece creates a new attack on a more valuable enemy piece.', matches: move => winsTempo(move) },
    { key: 'damages-pawn-structure', label: 'Damages pawn structure', description: 'A capture removes an opposing pawn.', matches: move => move.captured === 'p' },
    { key: 'pawn-storms', label: 'Pawn storms', description: 'A flank pawn advances into the opponent’s half of the board.', matches: move => move.piece === 'p' && wingFiles.has(move.to[0]) && (move.color === 'w' ? Number(move.to[1]) >= 5 : Number(move.to[1]) <= 4) },
    { key: 'center-control', label: 'Center control', description: 'The coach identifies occupation or new control of a central square.', matches: (_, __, ___, insights) => insights.some(text => /in the center/.test(text)) },
  ],
  endgames: [
    { key: 'promotions', label: 'Promotions', description: 'A pawn promotes to a new piece.', matches: move => Boolean(move.promotion) },
    { key: 'passed-pawns', label: 'Passed pawns', description: 'A pawn advances without an opposing pawn ahead on its file or an adjacent file.', matches: move => isPassedPawnMove(move) },
    { key: 'protected-passed-pawns', label: 'Protected passed pawns', description: 'An advanced passed pawn is defended by another friendly piece.', matches: move => passedPawnProtected(move) },
    { key: 'rook-supports-passed-pawn', label: 'Rook supports passed pawn', description: 'A rook stands behind a friendly passed pawn on the same file.', matches: move => rookSupportsPassedPawn(move) },
    { key: 'active-king', label: 'Active king', description: 'The king moves during the engine-classified endgame phase.', matches: move => move.phase === 'endgame' && move.piece === 'k' },
    { key: 'seventh-rank-rook', label: 'Rook on seventh rank', description: 'The rook reaches the opponent’s second or seventh rank.', matches: move => move.piece === 'r' && (move.color === 'w' ? move.to[1] === '7' : move.to[1] === '2') },
    { key: 'opposition', label: 'Opposition', description: 'The kings face each other with one square between them.', matches: move => move.phase === 'endgame' && opposition(move) },
    { key: 'king-pawn-endgames', label: 'King-pawn endgames', description: 'The resulting position contains only kings and pawns.', matches: move => move.phase === 'endgame' && materialTheme(move, 'king-pawn') },
    { key: 'queen-endgames', label: 'Queen endgames', description: 'Queens and pawns are the only remaining non-king pieces.', matches: move => move.phase === 'endgame' && materialTheme(move, 'queen') },
    { key: 'rook-endgames', label: 'Rook endgames', description: 'Rooks and pawns are the only remaining non-king pieces.', matches: move => move.phase === 'endgame' && materialTheme(move, 'rook') },
    { key: 'knight-bishop-endgames', label: 'Knight-bishop endgames', description: 'Knights, bishops, and pawns are the only remaining non-king pieces.', matches: move => move.phase === 'endgame' && materialTheme(move, 'knight-bishop') },
    { key: 'queen-checkmates', label: 'Queen checkmates', description: 'A queen delivers checkmate.', matches: move => move.piece === 'q' && checkmateMove(move) },
    { key: 'rook-checkmates', label: 'Rook checkmates', description: 'A rook delivers checkmate.', matches: move => move.piece === 'r' && checkmateMove(move) },
    { key: 'connects-rooks-seventh', label: 'Connects rooks on seventh', description: 'The move connects rooks while one stands on the opponent’s second or seventh rank.', matches: move => connectedRooks(move) && move.piece === 'r' && (move.color === 'w' ? move.to[1] === '7' : move.to[1] === '2') },
    { key: 'checkmates', label: 'Checkmates', description: 'A recorded move ends in orthodox checkmate.', matches: move => move.san.endsWith('#') && !move.variant },
  ],
}

export function skillThemeGroup(review: GameReview, tab: SkillTab): SkillThemeGroup {
  const groupHits = new Map<string, Record<Color, number[]>>()
  const definitions = detections[tab]
  for (const [index, move] of review.moves.entries()) {
    const insights = insightsForMove(move)
    for (const theme of definitions) {
      if (!theme.matches(move, index, review.moves, insights)) continue
      const plies = groupHits.get(theme.key) ?? { w: [], b: [] }
      plies[move.color].push(move.ply)
      groupHits.set(theme.key, plies)
    }
  }
  return {
    key: tab, label: skillTabs.find(item => item.key === tab)!.label,
    themes: definitions.map(theme => ({
      key: theme.key, label: theme.label, description: theme.description,
      plies: groupHits.get(theme.key) ?? { w: [], b: [] },
    })),
  }
}

export function skillThemeGroups(review: GameReview): SkillThemeGroup[] {
  return skillTabs.map(tab => skillThemeGroup(review, tab.key))
}
