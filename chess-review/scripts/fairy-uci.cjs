const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const directory = path.dirname(require.resolve('fairy-stockfish-nnue.wasm/package.json'))
const create = require(path.join(directory, 'stockfish.js'))

create({ wasmBinary: fs.readFileSync(path.join(directory, 'stockfish.wasm')) }).then(engine => {
  engine.addMessageListener(line => process.stdout.write(`${line}\n`))
  const input = readline.createInterface({ input: process.stdin })
  input.on('line', line => {
    if (line === 'quit') { input.close(); return }
    engine.postMessage(line)
  })
  input.on('close', () => { engine.terminate(); process.exit(0) })
}).catch(error => { process.stderr.write(`${error.message}\n`); process.exit(1) })
