import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { Chess960Board, parseChess960Pgn } from './chess960'

const setup = 'brqbknrn/pppppppp/8/8/8/8/PPPPPPPP/BRQBKNRN w GBgb - 0 1'
const publicPgn = `[Event "Live Chess - Chess960"]
[White "MagnusCarlsen"]
[Black "Fh2411"]
[Variant "Chess960"]
[SetUp "1"]
[FEN "${setup}"]
[Result "1-0"]
[Link "https://www.chess.com/game/live/186477389371"]

1. d4 {[%clk 0:02:57.9]} Nhg6 2. e4 c5 3. d5 b5 4. Ne3 c4 5. O-O d6 6. b4 Nd7 7. Ng3 e6 8. Nh5 Bf6 9. Nxf6+ gxf6 10. f4 Qc7 11. Bg4 e5 12. Bxd7+ Qxd7 13. Nf5 Ne7 14. Nh6 Rg6 15. fxe5 dxe5 16. Qe3 O-O-O 17. Nxf7 Nxd5 18. Qc5+ Nc7 19. Nxd8 Qxd8 20. Bxe5 fxe5 21. Rf8 Bxe4 22. Rxd8+ Kxd8 23. Qf8+ Kd7 24. Rd1+ Kc6 25. Qc5+ Kb7 26. Rd7 Bc6 27. Rxh7 Rxg2+ 28. Kf1 Rg5 29. Rxc7+ 1-0`

test('replays actual Chess.com Chess960 PGN with both castlings to the public final FEN', () => {
  const game = parseChess960Pgn(publicPgn)
  assert.equal(game.variant, 'chess960')
  assert.equal(game.moves.length, 57)
  assert.equal(game.positions.at(-1), '8/pkR5/2b5/1pQ1p1r1/1Pp5/8/P1P4P/5K2 b - - 0 29')
  assert.equal(game.result, '1-0')
  assert.equal(game.clocks[0], 177.9)
  assert.equal(game.clocks[1], null)
  assert.equal(game.moves[8].san, 'O-O')
  assert.equal(game.moves[8].uci, 'e1g1')
  assert.equal((game.moves[8] as { kingTo?: string }).kingTo, 'g1')
  assert.equal(game.moves[31].san, 'O-O-O')
  assert.equal(game.moves[31].uci, 'e8b8')
  assert.equal((game.moves[31] as { kingTo?: string }).kingTo, 'c8')
})

test('handles the public checkmating game with king initially on b1 and queenside castling to c1', () => {
  const pgn = `[Variant "Chess960"]\n[FEN "rkqrnbbn/pppppppp/8/8/8/8/PPPPPPPP/RKQRNBBN w DAda - 0 1"]\n[Result "1-0"]\n\n1. d4 f5 2. f3 d5 3. Nd3 Ng6 4. Nhf2 Nd6 5. g3 a5 6. a4 e6 7. Bg2 Ra6 8. e4 fxe4 9. fxe4 Nc4 10. b3 Rb6 11. Nc5 dxe4 12. Nfxe4 e5 13. dxe5 Rxd1 14. Qxd1 Ngxe5 15. Qd4 g6 16. O-O-O Bh6+ 17. Kb1 Na3+ 18. Kb2 Nec4+ 19. Kc3 Nd6 20. Kb2 Nac4+ 21. Ka2 Qe8 22. Bf3 Ne5 23. Qxe5 Qxe5 24. Nd7+ Ka8 25. Nxe5 Rb4 26. Nxd6 cxd6 27. Rxd6 Bg5 28. Nd7 Rxa4+ 29. Kb2 Bc1+ 30. Kxc1 Ra1+ 31. Kb2 Rxg1 32. Ra6# 1-0`
  const game = parseChess960Pgn(pgn)
  assert.equal(game.moves.length, 63)
  assert.equal(game.moves[30].uci, 'b1a1')
  assert.equal(game.positions.at(-1), 'k5b1/1p1N3p/R5p1/p7/8/1P3BP1/1KP4P/6r1 b - - 1 32')
  assert.equal(new Chess960Board(game.positions.at(-1)!).isCheckmate(), true)
})

test('castling moves king and rook legally when either piece stays, they swap or their paths cross', () => {
  const cases = [
    ['6KR', 'H', 'O-O', 'g1h1', '5RK1', 'g1', 'f1'],
    ['4KR2', 'F', 'O-O', 'e1f1', '5RK1', 'g1', 'f1'],
    ['5KR1', 'G', 'O-O', 'f1g1', '5RK1', 'g1', 'f1'],
    ['RK6', 'A', 'O-O-O', 'b1a1', '2KR4', 'c1', 'd1'],
    ['R1K5', 'A', 'O-O-O', 'c1a1', '2KR4', 'c1', 'd1'],
    ['3RK3', 'D', 'O-O-O', 'e1d1', '2KR4', 'c1', 'd1'],
    ['2RK4', 'C', 'O-O-O', 'd1c1', '2KR4', 'c1', 'd1'],
  ]
  for (const [rank, rights, san, uci, afterRank, kingTo, rookTo] of cases) {
    const board = new Chess960Board(`4k3/8/8/8/8/8/8/${rank} w ${rights} - 0 1`)
    assert.ok(board.moves().includes(san), rank)
    const move = board.move(san)
    assert.equal(move.uci, uci)
    assert.equal(move.kingTo, kingTo)
    assert.equal(move.rookTo, rookTo)
    assert.equal(board.fen(), `4k3/8/8/8/8/8/8/${afterRank} b - - 1 1`)
    board.undo()
    assert.equal(board.move(uci).after, move.after)
  }
})

test('rejects castling out of check, through attacked squares, into check, with blockers or lost rights', () => {
  const illegal = [
    'k3r3/8/8/8/8/8/8/4K2R w H - 0 1',
    'k4r2/8/8/8/8/8/8/4K2R w H - 0 1',
    'k5r1/8/8/8/8/8/8/4K2R w H - 0 1',
    '4k3/8/8/8/8/8/8/4KN1R w H - 0 1',
    '4k3/8/8/8/8/8/8/4K2R w - - 0 1',
    '4k3/8/8/8/8/8/8/rRK5 w B - 0 1',
  ]
  for (const fen of illegal) {
    const board = new Chess960Board(fen)
    assert.ok(!board.moves().some(san => san.startsWith('O-O')), fen)
    assert.throws(() => board.move(fen.includes('rRK') ? 'O-O-O' : 'O-O'), /Illegal Chess960/)
  }
})

test('rook movement, rook capture and king movement permanently remove the corresponding castling rights', () => {
  const board = new Chess960Board('4k3/8/8/8/8/8/8/RK5R w HA - 0 1')
  board.move('Rh2')
  assert.equal(board.fen().split(' ')[2], 'A')
  board.move('Kd7')
  board.move('Rh1')
  assert.equal(board.fen().split(' ')[2], 'A')
  const capture = new Chess960Board('4k2r/8/8/8/8/8/8/RK5R b HA - 0 1')
  capture.move('Rxh1+')
  assert.equal(capture.fen().split(' ')[2], 'A')
  const king = new Chess960Board('4k3/8/8/8/8/8/8/RK5R w HA - 0 1')
  king.move('Kc2')
  assert.equal(king.fen().split(' ')[2], '-')
})

test('preserves en passant, promotions, checkmate and normal verbose move details', () => {
  const ep = new Chess960Board('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2')
  const move = ep.move('exd6')
  assert.equal(move.flags, 'e')
  assert.equal(move.captured, 'p')
  assert.equal(ep.get('d5'), undefined)
  const promotion = new Chess960Board('7k/P7/8/8/8/8/8/4K3 w - - 0 1')
  assert.deepEqual(promotion.moves({ square: 'a7', verbose: true }).map(move => move.promotion).sort(), ['b', 'n', 'q', 'r'])
  assert.equal(promotion.move('a7a8n').uci, 'a7a8n')
  assert.equal(promotion.get('a8')?.type, 'n')
  const mate = new Chess960Board('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1')
  assert.equal(mate.isCheckmate(), true)
  assert.equal(mate.isGameOver(), true)
  assert.deepEqual(mate.moves(), [])
})

test('repetition uses position history, undo restores it, fifty-move and insufficient-material draws are explicit', () => {
  const board = new Chess960Board('4k3/8/8/8/8/8/8/RK5R w HA - 0 1')
  for (const san of ['Rh2', 'Kd7', 'Rh1', 'Ke8', 'Rh2', 'Kd7', 'Rh1', 'Ke8']) board.move(san)
  assert.equal(board.isThreefoldRepetition(), false)
  for (const san of ['Rh2', 'Kd7', 'Rh1', 'Ke8']) board.move(san)
  assert.equal(board.isThreefoldRepetition(), true)
  assert.equal(board.isDraw(), true)
  board.undo()
  assert.equal(board.isThreefoldRepetition(), true)
  assert.equal(new Chess960Board(board.fen()).isThreefoldRepetition(), false)
  assert.equal(new Chess960Board('4k3/8/8/8/8/8/8/RK6 w A - 100 51').isDrawByFiftyMoves(), true)
  assert.equal(new Chess960Board('4k3/8/8/8/8/8/8/1K6 w - - 0 1').isInsufficientMaterial(), true)
})

test('standard starting placement is valid Chess960 and matches standard legal noncastling play', () => {
  const ordinary = new Chess()
  const board = new Chess960Board(ordinary.fen())
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6']) {
    const expected = ordinary.move(san)
    const move = board.move(san)
    assert.equal(move.san, expected.san)
    assert.equal(move.uci, `${expected.from}${expected.to}`)
    assert.equal(board.fen().split(' ')[0], ordinary.fen().split(' ')[0])
  }
  assert.equal(board.board().flat().filter(Boolean).length, 32)
  assert.equal(board.get('a4')?.type, 'b')
  assert.ok(board.attackers('e4', 'b').includes('f6'))
})

test('strict PGN replay rejects missing FEN, illegal mainline moves, malformed syntax and other variants', () => {
  assert.throws(() => parseChess960Pgn('1. e4 *'), /starting FEN/)
  assert.throws(() => new Chess960Board('invalid'), /Invalid Chess960 FEN/)
  assert.throws(() => new Chess960Board('4k3/8/8/8/8/8/8/4K3 w H - 0 1'), /Invalid Chess960 FEN/)
  assert.throws(() => parseChess960Pgn(`[FEN "${setup}"]\n\n1. Qh5 *`), /Illegal Chess960 move at ply 1/)
  assert.throws(() => parseChess960Pgn(`[FEN "${setup}"]\n\n1. d4 nonsense *`), /Illegal Chess960 move at ply 2/)
  assert.throws(() => parseChess960Pgn(`[FEN "${setup}"]\n\n1. d4 {unclosed`), /unclosed comment/)
  assert.throws(() => parseChess960Pgn(`[FEN "${setup}"]\n\n1. d4 (1. e4 *`), /unbalanced variations/)
  assert.throws(() => parseChess960Pgn(`[Variant "Atomic"]\n[FEN "${setup}"]\n\n*`), /does not identify a Chess960/)
  assert.throws(() => parseChess960Pgn(`[FEN "${setup}"]\n\n1. d4 * 1... e5`), /after.*result/)
})

test('annotations and variations do not inject moves or clocks into the mainline', () => {
  const parsed = parseChess960Pgn(`[FEN "${setup}"]\n\n1.d4!? {[%clk 0:02:50]} (1.e4 {[%clk 0:00:01]} e5 (1...d5)) 1...Nhg6 $2 {[%clk 0:02:40]} 2.e4 ;comment\nc5 *`)
  assert.deepEqual(parsed.moves.map(move => move.san), ['d4', 'Nhg6', 'e4', 'c5'])
  assert.deepEqual(parsed.clocks, [170, 160, null, null])
})
