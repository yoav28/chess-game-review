import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const commit = process.argv[2] ?? 'a6189a30dc273ccb21fc2536a9a2fefd5592a67a'
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Provide an exact upstream commit SHA.')
const upstream = 'https://github.com/lichess-org/chess-openings'
const raw = `https://raw.githubusercontent.com/lichess-org/chess-openings/${commit}`
const sourceNames = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv', 'COPYING.txt']
const sources = await Promise.all(sourceNames.map(async name => {
  const url = `${raw}/${name}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Cannot acquire ${url}: HTTP ${response.status}`)
  const text = await response.text()
  return { name, url, text, sha256: createHash('sha256').update(text).digest('hex') }
}))
if (!sources.find(source => source.name === 'COPYING.txt').text.includes('CC0 1.0 Universal')) throw new Error('The upstream license needs review before generating data.')
const nodes = [{ opening: -1, moves: new Map(), san: '' }]
const openings = []
const codes = new Set()
let rowCount = 0
let maximumPly = 0

for (const source of sources.filter(source => source.name.endsWith('.tsv'))) {
  const [header, ...lines] = source.text.trimEnd().split('\n')
  if (header.trimEnd() !== 'eco\tname\tpgn') throw new Error(`Unexpected header in ${source.name}`)
  for (const [lineIndex, line] of lines.entries()) {
    const fields = line.trimEnd().split('\t')
    if (fields.length !== 3 || !/^[A-E]\d{2}$/.test(fields[0])) throw new Error(`Invalid row ${source.name}:${lineIndex + 2}`)
    const [eco, name, pgn] = fields
    const board = new Chess()
    try {
      board.loadPgn(pgn, { strict: true })
    } catch (error) {
      throw new Error(`Illegal PGN at ${source.name}:${lineIndex + 2}: ${error.message}`)
    }
    const history = board.history({ verbose: true })
    if (!history.length || history[0].before !== new Chess().fen()) throw new Error(`Unexpected setup at ${source.name}:${lineIndex + 2}`)
    let nodeId = 0
    for (const move of history) {
      const uci = move.from + move.to + (move.promotion ?? '')
      let child = nodes[nodeId].moves.get(uci)
      if (child === undefined) {
        child = nodes.length
        nodes.push({ opening: -1, moves: new Map(), san: move.san })
        nodes[nodeId].moves.set(uci, child)
      } else if (nodes[child].san !== move.san) {
        throw new Error(`Inconsistent notation at ${source.name}:${lineIndex + 2}`)
      }
      nodeId = child
    }
    if (nodes[nodeId].opening !== -1) throw new Error(`Duplicate opening line at ${source.name}:${lineIndex + 2}`)
    nodes[nodeId].opening = openings.length
    openings.push([name, eco])
    codes.add(eco)
    maximumPly = Math.max(maximumPly, history.length)
    rowCount++
  }
}

const data = {
  openings,
  nodes: nodes.map(node => [node.opening, [...node.moves].map(([uci, child]) => [uci, nodes[child].san, child])]),
}
const serialized = JSON.stringify(data) + '\n'
const directory = new URL('../src/data/openings/', import.meta.url)
await mkdir(directory, { recursive: true })
await writeFile(new URL('lichess.json', directory), serialized)
await writeFile(new URL('CC0-1.0.txt', directory), sources.find(source => source.name === 'COPYING.txt').text)
const provenance = {
  name: 'Lichess chess-openings', upstream, commit,
  source: `${upstream}/tree/${commit}`, license: 'CC0-1.0',
  licenseSource: `${upstream}/blob/${commit}/COPYING.txt`,
  files: sources.map(({ name, url, sha256 }) => ({ name, url, sha256 })),
  generated: {
    rows: rowCount, nodes: nodes.length, ecoCodes: codes.size, maximumPly,
    bytes: Buffer.byteLength(serialized), sha256: createHash('sha256').update(serialized).digest('hex'),
  },
  matching: 'Exact legal UCI move prefixes from the standard starting position. Canonical SAN is stored on each edge. The deepest completed named line supplies the opening; book status requires the entire supplied move sequence to remain a dataset prefix. Transposed move orders are recognized only when explicitly present in the dataset.',
  reproduce: `node scripts/update-openings.mjs ${commit}`,
}
await writeFile(new URL('provenance.json', directory), JSON.stringify(provenance, null, 2) + '\n')
await writeFile(new URL('README.md', directory), `# Lichess opening names\n\nSource: [lichess-org/chess-openings](${upstream}/tree/${commit}), pinned to commit ${commit}.\n\nThe upstream project dedicates its opening facts and copyrightable contributions to the public domain under CC0 1.0. The complete dedication is preserved in [CC0-1.0.txt](CC0-1.0.txt). File URLs, SHA-256 digests, validation counts, and the matching rule are recorded in [provenance.json](provenance.json).\n\nAll ${rowCount} source PGNs were parsed strictly and legally replayed with chess.js before generating the ${nodes.length}-node UCI trie. The runtime uses prevalidated canonical SAN edges and does not parse PGNs. Opening names and ECO codes retain upstream spelling. Book means an exact registered prefix, not a claim that a move is objectively best. The last named ancestor remains visible after a deviation, while book becomes false.\n\nRegenerate from the app directory with:\n\n\`\`\`sh\nnode scripts/update-openings.mjs ${commit}\n\`\`\`\n`)
console.log(`Validated ${rowCount} legal opening lines across ${codes.size} ECO codes; wrote ${nodes.length} nodes (${Buffer.byteLength(serialized)} bytes) to ${fileURLToPath(directory)}.`)
