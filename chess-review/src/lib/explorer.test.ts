import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { canonicalPosition, exploreImportedGames } from './explorer'
import { gameFromPgn, type GameRecord } from './game'
import { demoGame } from './demo'

function game(id: string, moves: string, result = '1-0', ratings = [1500, 1700]): GameRecord {
  return {
    ...gameFromPgn(`[White "Ada"]\n[Black "Grace"]\n[Result "${result}"]\n\n${moves} ${result}`),
    id,
    url: `https://www.chess.com/game/live/${id}`,
    white: { username: 'Ada', rating: ratings[0], result: result === '1-0' ? 'win' : result === '1/2-1/2' ? 'agreed' : result === '*' ? 'unfinished' : 'resigned' },
    black: { username: 'Grace', rating: ratings[1], result: result === '0-1' ? 'win' : result === '1/2-1/2' ? 'agreed' : result === '*' ? 'unfinished' : 'resigned' },
  }
}

const initialFen = new Chess().fen()

test('explorer aggregates unique games, legal next moves, White-perspective results and known ratings', async () => {
  const first = game('one', '1. e4 e5', '1-0', [1500, 1700])
  const result = await exploreImportedGames([
    first,
    { ...first, id: 'different-id-same-url' },
    game('two', '1. e4 c5', '0-1', [1800, 0]),
    game('three', '1. d4 d5', '1/2-1/2'),
    game('four', '1. e4 e6', '*', [0, 0]),
  ], initialFen)
  assert.equal(result.matchingGames, 4)
  assert.equal(result.standardGames, 4)
  assert.equal(result.duplicateGames, 1)
  assert.equal(result.scanned, 5)
  assert.deepEqual(result.moves[0], { uci: 'e2e4', san: 'e4', games: 3, whiteWins: 1, blackWins: 1, draws: 0, unknownResults: 1, averageRating: 1667 })
  assert.equal(result.moves[1].uci, 'd2d4')
  assert.equal(result.moves[1].draws, 1)
})

test('matching uses actual transposed positions and ignores FEN move counters', async () => {
  const board = new Chess()
  for (const san of ['d4', 'Nf6', 'Nf3', 'd5']) board.move(san)
  const target = board.fen().replace(/\d+ \d+$/, '40 80')
  const result = await exploreImportedGames([
    game('one', '1. d4 Nf6 2. Nf3 d5 3. e3'),
    game('two', '1. Nf3 d5 2. d4 Nf6 3. c4'),
    game('other', '1. e4 e5'),
  ], target)
  assert.equal(result.matchingGames, 2)
  assert.deepEqual(result.moves.map(move => move.san).sort(), ['c4', 'e3'])
})

test('side, castling rights and legally available en passant remain part of a position', async () => {
  assert.notEqual(canonicalPosition(initialFen), canonicalPosition(initialFen.replace(' w ', ' b ')))
  assert.notEqual(canonicalPosition(initialFen), canonicalPosition(initialFen.replace(' KQkq ', ' - ')))
  assert.equal(canonicalPosition('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'), canonicalPosition('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'))
  const ep = '8/8/8/3pP3/8/8/8/K6k w - d6 0 2'
  assert.notEqual(canonicalPosition(ep), canonicalPosition(ep.replace(' d6 ', ' - ')))
  const pinned = 'k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 2'
  assert.equal(canonicalPosition(pinned), canonicalPosition(pinned.replace(' d6 ', ' - ')))
  const setup = { ...game('ep', '1. e4'), pgn: `[SetUp "1"]\n[FEN "${ep}"]\n[Result "*"]\n\n2. exd6 *` }
  const result = await exploreImportedGames([setup], ep)
  assert.equal(result.moves[0].uci, 'e5d6')
  assert.equal((await exploreImportedGames([setup], ep.replace(' d6 ', ' - '))).matchingGames, 0)
})

test('a game contributes once per distinct continuation when the position repeats', async () => {
  const result = await exploreImportedGames([game('repeat', '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. e4')], initialFen)
  assert.equal(result.matchingGames, 1)
  assert.deepEqual(result.moves.map(move => [move.san, move.games]), [['e4', 1], ['Nf3', 1]])
})

test('skips variants and wholly rejects malformed PGN games rather than retaining partial counts', async () => {
  const valid = game('valid', '1. d4 d5')
  const result = await exploreImportedGames([
    valid,
    { ...game('bad', '1. e4 e5'), pgn: '1. e4 e5 2. Qxe8 *' },
    { ...game('variant', '1. e4'), rules: 'chess960' },
  ], initialFen)
  assert.equal(result.skippedGames, 2)
  assert.equal(result.standardGames, 1)
  assert.equal(result.matchingGames, 1)
  assert.deepEqual(result.moves.map(move => move.san), ['d4'])
})

test('a terminal matching position counts the game without inventing a next move', async () => {
  const board = new Chess()
  board.loadPgn(demoGame.pgn)
  const result = await exploreImportedGames([demoGame], board.fen())
  assert.equal(result.matchingGames, 1)
  assert.deepEqual(result.moves, [])
})

test('every supplied game is scanned without a result cap', async () => {
  const games = Array.from({ length: 129 }, (_, index) => game(`all-${index}`, index === 128 ? '1. d4 d5' : '1. e4 e5'))
  let lastScanned = 0
  const result = await exploreImportedGames(games, initialFen, { onProgress: value => { lastScanned = value.scanned } })
  assert.equal(result.scanned, 129)
  assert.equal(result.standardGames, 129)
  assert.equal(lastScanned, 129)
  assert.equal(result.moves.find(move => move.san === 'e4')?.games, 128)
  assert.equal(result.moves.find(move => move.san === 'd4')?.games, 1)
})

test('parses annotated mainlines without counting variation moves', async () => {
  const annotated = { ...game('annotated', '1. e4'), pgn: '[Result "1-0"]\n\n1.e4!? {A comment} (1. d4 d5 (1...Nf6)) 1...e5 $2 2. Nf3 ;ignored\nNc6 1-0' }
  const result = await exploreImportedGames([annotated], initialFen)
  assert.equal(result.standardGames, 1)
  assert.deepEqual(result.moves.map(move => move.san), ['e4'])
})

test('large searches yield to the event loop and AbortSignal cancels the active scan', async () => {
  const controller = new AbortController()
  const games = Array.from({ length: 300 }, (_, index) => ({ ...demoGame, id: `game-${index}`, url: '' }))
  let yielded = false
  let scannedBeforeAbort = 0
  const timer = setTimeout(() => { yielded = true }, 0)
  await assert.rejects(exploreImportedGames(games, initialFen, {
    signal: controller.signal,
    onProgress: progress => {
      if (progress.scanned > 0) { scannedBeforeAbort = progress.scanned; controller.abort() }
    },
  }), { name: 'AbortError' })
  clearTimeout(timer)
  assert.equal(yielded, true)
  assert.ok(scannedBeforeAbort > 0 && scannedBeforeAbort < games.length)
})

test('empty libraries are explicit and invalid query positions are rejected', async () => {
  const result = await exploreImportedGames([], initialFen)
  assert.equal(result.scanned, 0)
  assert.deepEqual(result.moves, [])
  await assert.rejects(exploreImportedGames([], 'invalid FEN'), /Invalid FEN/)
})

test('Chess960 exploration returns canonical castling moves and never mixes standard inventories', async () => {
  const fen = '4k3/8/8/8/8/8/8/5K1R w H - 0 1'
  const chess960 = gameFromPgn(`[Variant "Chess960"]\n[FEN "${fen}"]\n\n1. O-O *`)
  const result = await exploreImportedGames([chess960, game('standard', '1. e4')], fen, { variant: 'chess960' })
  assert.equal(result.variant, 'chess960')
  assert.equal(result.matchingGames, 1)
  assert.equal(result.skippedGames, 1)
  assert.equal(result.moves[0].uci, 'f1h1')
  assert.equal(result.moves[0].san, 'O-O')
  const noRights = '4k3/8/8/8/8/8/8/R5K1 w - - 0 1'
  const ordinary = gameFromPgn(`[FEN "${noRights}"]\n[SetUp "1"]\n\n1. Ra2 *`)
  const variantGame = gameFromPgn(`[Variant "Chess960"]\n[FEN "${noRights}"]\n\n1. Ra2 *`)
  const explicit = await exploreImportedGames([ordinary, variantGame], noRights, { variant: 'chess960' })
  assert.equal(explicit.standardGames, 1)
  assert.equal(explicit.moves[0].games, 1)
  assert.equal(explicit.skippedGames, 1)
})
