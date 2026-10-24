import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Chess } from 'chess.js'
import openingData from '../data/openings/lichess.json'
import provenance from '../data/openings/provenance.json'
import { openingForMoves } from './openings'

type OpeningData = {
  openings: [string, string][]
  nodes: [number, [string, string, number][]][]
}
const data = openingData as unknown as OpeningData

test('the generated trie preserves every legally replayed opening and all 500 ECO codes', () => {
  const board = new Chess()
  let visited = 0
  const named = new Set<number>()
  function visit(nodeId: number, sans: string[], ucis: string[]) {
    visited++
    const [label, edges] = data.nodes[nodeId]
    if (label !== -1) {
      named.add(label)
      const [name, eco] = data.openings[label]
      assert.deepEqual(openingForMoves(sans), { opening: { name, eco }, book: true })
      assert.deepEqual(openingForMoves(ucis), openingForMoves(sans))
    }
    const moves = new Set<string>()
    for (const [uci, san, child] of edges) {
      assert.equal(moves.has(uci), false)
      moves.add(uci)
      assert.ok(child > nodeId && child < data.nodes.length)
      const move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      assert.equal(move.san, san)
      visit(child, [...sans, san], [...ucis, uci])
      board.undo()
    }
  }
  visit(0, [], [])
  assert.equal(visited, 8802)
  assert.equal(named.size, 3865)
  assert.equal(new Set(data.openings.map(([, eco]) => eco)).size, 500)
  assert.equal(board.fen(), new Chess().fen())
})

test('broad named variations resolve to the deepest exact registered line', () => {
  const cases: [string, string, string][] = [
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian Defense: Najdorf Variation', 'B90'],
    ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian Defense', 'E20'],
    ['d4 f5', 'Dutch Defense', 'A80'],
    ['d4 d5 c4 e5', "Queen's Gambit Declined: Albin Countergambit", 'D08'],
    ['e4 e5 Nc3', 'Vienna Game', 'C25'],
    ['e4 a6', 'St. George Defense', 'B00'],
  ]
  for (const [line, name, eco] of cases) assert.deepEqual(openingForMoves(line.split(' ')), { opening: { name, eco }, book: true })
})

test('deviations retain the last exact name while losing book status', () => {
  const line = ['e4', 'e5', 'Qh5']
  const known = openingForMoves(line)
  assert.deepEqual(known, { opening: { name: "King's Pawn Game: Wayward Queen Attack", eco: 'C20' }, book: true })
  const deviation = openingForMoves([...line, 'a6', 'h3'])
  assert.equal(deviation.book, false)
  assert.deepEqual(deviation.opening, known.opening)
  assert.deepEqual(openingForMoves([]), { opening: null, book: false })
  assert.deepEqual(openingForMoves(['invalid']), { opening: null, book: false })
  assert.equal(openingForMoves(['e4', 'e5', 'Qh5', 'e8e1']).book, false)
})

test('names do not claim a known variation merely from a matching final position', () => {
  const exact = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
  const repeated = ['Nf3', 'Nf6', 'Ng1', 'Ng8', ...exact]
  const first = new Chess()
  const second = new Chess()
  exact.forEach(move => first.move(move))
  repeated.forEach(move => second.move(move))
  assert.equal(first.fen().split(' ').slice(0, 4).join(' '), second.fen().split(' ').slice(0, 4).join(' '))
  assert.equal(openingForMoves(exact).opening?.name, 'Italian Game')
  assert.equal(openingForMoves(repeated).book, false)
  assert.notEqual(openingForMoves(repeated).opening?.name, 'Italian Game')
})

test('the generated artifact has pinned primary-source provenance and its unmodified CC0 dedication', async () => {
  assert.equal(provenance.commit, 'a6189a30dc273ccb21fc2536a9a2fefd5592a67a')
  assert.equal(provenance.license, 'CC0-1.0')
  assert.deepEqual(provenance.files.map(file => file.name), ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv', 'COPYING.txt'])
  for (const file of provenance.files) {
    assert.equal(file.url, `https://raw.githubusercontent.com/lichess-org/chess-openings/${provenance.commit}/${file.name}`)
    assert.match(file.sha256, /^[a-f0-9]{64}$/)
  }
  const artifact = await readFile(new URL('../data/openings/lichess.json', import.meta.url))
  assert.equal(createHash('sha256').update(artifact).digest('hex'), provenance.generated.sha256)
  assert.equal(artifact.byteLength, provenance.generated.bytes)
  assert.equal(artifact.byteLength < 600_000, true)
  const license = await readFile(new URL('../data/openings/CC0-1.0.txt', import.meta.url))
  assert.equal(createHash('sha256').update(license).digest('hex'), provenance.files.find(file => file.name === 'COPYING.txt')?.sha256)
  assert.match(license.toString(), /CC0 1\.0 Universal/)
})
