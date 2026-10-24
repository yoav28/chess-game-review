import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { parsePgn, type MoveReview } from './review'
import { trainingPlan } from './training'

function reviewed(fen: string, played: string, best: string, overrides: Partial<MoveReview> = {}): MoveReview {
  const turn = fen.split(' ')[1] === 'w' ? '1.' : '1...'
  const parsed = parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n${turn} ${played} *`).moves[0]
  const board = new Chess(fen)
  const alternative = board.move(best)
  return {
    ...parsed, classification: 'mistake', centipawnLoss: 200, accuracy: 40,
    beforeEvaluation: { cp: 100, mate: null }, evaluation: { cp: -100, mate: null },
    bestMove: `${alternative.from}${alternative.to}${alternative.promotion ?? ''}`, bestMoveSan: alternative.san,
    pv: [], pvSan: [], depth: 16, phase: 'middlegame', explanation: '', ...overrides,
  }
}

test('training identifies legal captures of a loose piece left by the error', () => {
  const move = reviewed('4k3/8/5n2/8/8/8/8/3QK3 w - - 0 1', 'Qh5+', 'Qd3')
  const [exercise] = trainingPlan({ moves: [move] }, 'w')
  assert.equal(exercise.theme, 'loose-pieces')
  assert.match(exercise.evidence, /queen on h5.*Nxh5 is a legal capture/)
  assert.match(exercise.hint, /queen on d1/)
})

test('a geometrically attacking pinned piece does not create a loose-piece recommendation', () => {
  const move = reviewed('5k2/8/5n2/8/8/8/8/3QKR2 w - - 0 1', 'Qh5', 'Qd3')
  const [exercise] = trainingPlan({ moves: [move] }, 'w')
  assert.notEqual(exercise.theme, 'loose-pieces')
})

test('training offers a factual double-attack exercise from the engine alternative', () => {
  const move = reviewed('k7/3q3r/8/3N4/8/8/8/4K3 w - - 0 1', 'Nc3', 'Nf6')
  const [exercise] = trainingPlan({ moves: [move] }, 'w')
  assert.equal(exercise.theme, 'fork')
  assert.match(exercise.evidence, /queen on d7 and the rook on h7/)
  assert.doesNotMatch(exercise.evidence, /wins material/)
})

test('training identifies a new absolute pin in the legal alternative', () => {
  const move = reviewed('4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', 'Be2', 'Bb5')
  const [exercise] = trainingPlan({ moves: [move] }, 'w')
  assert.equal(exercise.theme, 'pin')
  assert.match(exercise.evidence, /pins the knight on c6 to the king/)
})

test('immediate mating alternative becomes a mating drill for Black', () => {
  const fen = parsePgn('1. f3 e5 2. g4 *').moves.at(-1)!.afterFen
  const move = reviewed(fen, 'Nc6', 'Qh4#')
  const [exercise] = trainingPlan({ moves: [move] }, 'b')
  assert.equal(exercise.theme, 'mate')
  assert.match(exercise.evidence, /immediate checkmate/)
  assert.equal(exercise.moveLabel, '2... Nc6')
  assert.equal(trainingPlan({ moves: [move] }, 'w').length, 0)
})

test('legal castling and early minor-piece development have dedicated goals', () => {
  const castle = reviewed('r3k2r/ppp2ppp/8/8/8/8/PPP2PPP/R3K2R w KQkq - 0 1', 'Rb1', 'O-O')
  assert.equal(trainingPlan({ moves: [castle] }, 'w')[0].theme, 'castling')
  const development = reviewed(new Chess().fen(), 'a3', 'Nf3', { phase: 'opening' })
  const [exercise] = trainingPlan({ moves: [development] }, 'w')
  assert.equal(exercise.theme, 'development')
  assert.match(exercise.evidence, /knight develops from the back rank/)
})

test('recommendations rank the selected side’s losses and retain actual move references', () => {
  const initial = new Chess().fen()
  const moves = [
    reviewed(initial, 'a3', 'Nf3', { ply: 1, centipawnLoss: 90, classification: 'inaccuracy' }),
    reviewed(initial, 'a3', 'Nf3', { ply: 9, centipawnLoss: 600, classification: 'blunder' }),
    reviewed(initial, 'a3', 'Nf3', { ply: 7, centipawnLoss: 400 }),
    reviewed(initial, 'a3', 'Nf3', { ply: 5, centipawnLoss: 500 }),
  ]
  const before = [...moves]
  assert.deepEqual(trainingPlan({ moves }, 'w').map(exercise => exercise.ply), [9, 5, 7])
  assert.deepEqual(moves, before)
})

test('no recommendations are invented without an eligible reviewed error and legal alternative', () => {
  const initial = new Chess().fen()
  const moves = [
    reviewed(initial, 'a3', 'Nf3', { classification: 'good', centipawnLoss: 10 }),
    reviewed(initial, 'a3', 'Nf3', { classification: 'book' }),
    reviewed(initial, 'a3', 'Nf3', { bestMove: null }),
    reviewed(initial, 'a3', 'Nf3', { bestMove: 'e1e8' }),
    reviewed(initial, 'a3', 'Nf3', { bestMove: 'a2a3' }),
  ]
  assert.deepEqual(trainingPlan({ moves }, 'w'), [])
})

test('unmatched positions get an honest phase-specific calculation exercise', () => {
  const move = reviewed('4k3/8/8/8/8/8/4P3/4K3 w - - 0 30', 'Kd2', 'Kf2', { phase: 'endgame' })
  const [exercise] = trainingPlan({ moves: [move] }, 'w')
  assert.equal(exercise.theme, 'calculation')
  assert.equal(exercise.title, 'Revisit this endgame decision')
  assert.match(exercise.evidence, /depth 16/)
})

test('current training ranks winning-chance losses rather than large centipawn swings in already winning positions', () => {
  const initial = new Chess().fen()
  const moves = [
    reviewed(initial, 'a3', 'Nf3', { ply: 1, centipawnLoss: 2000, winningChanceLoss: 3 }),
    reviewed(initial, 'a3', 'Nf3', { ply: 3, centipawnLoss: 20, winningChanceLoss: 12 }),
    reviewed(initial, 'a3', 'Nf3', { ply: 5, centipawnLoss: 500, winningChanceLoss: 8 }),
    reviewed(initial, 'a3', 'Nf3', { ply: 7, centipawnLoss: 2000, winningChanceLoss: 0 }),
  ]
  const exercises = trainingPlan({ moves }, 'w')
  assert.deepEqual(exercises.map(exercise => exercise.ply), [3, 5, 1])
  assert.equal(exercises[0].lossText, '−12.0 winning-chance points')
  assert.equal(exercises[0].winningChanceLoss, 12)
})

test('current calculation evidence uses winning-chance points while old reviews retain centipawn units', () => {
  const current = reviewed('4k3/8/8/8/8/8/4P3/4K3 w - - 0 30', 'Kd2', 'Kf2', { phase: 'endgame', winningChanceLoss: 7.25 })
  const [exercise] = trainingPlan({ moves: [current] }, 'w')
  assert.match(exercise.evidence, /lost 7\.3 winning-chance points at depth 16/)
  assert.doesNotMatch(exercise.lossText, /pawns/)
  const legacy = { ...current, winningChanceLoss: undefined }
  assert.match(trainingPlan({ moves: [legacy] }, 'w')[0].lossText, /−2\.00 pawns/)
})

test('Chess960 training derives a legal mating-castle exercise without standard castling assumptions', () => {
  const move: MoveReview = {
    ...parsePgn('[Variant "Chess960"]\n[FEN "4rkr1/4p1p1/8/8/8/8/8/5K1R w H - 0 1"]\n\n1. Ke1 *').moves[0],
    classification: 'mistake', centipawnLoss: 500, accuracy: 20,
    beforeEvaluation: { cp: 99999, mate: 1 }, evaluation: { cp: -100, mate: null },
    bestMove: 'f1h1', bestMoveSan: 'O-O#', pv: ['f1h1'], pvSan: ['O-O#'], depth: 16, phase: 'endgame', explanation: '',
  }
  const [exercise] = trainingPlan({ moves: [move] }, 'w')
  assert.equal(exercise.theme, 'mate')
  assert.match(exercise.evidence, /immediate checkmate/)
  assert.match(exercise.hint, /king on f1/)
})
