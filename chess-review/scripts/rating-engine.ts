import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
export const ratingEngineFile = join(dirname(require.resolve('stockfish/package.json')), 'bin/stockfish-19-lite-single.js')

class RatingWorker extends EventTarget {
  private process = spawn(process.execPath, [ratingEngineFile])
  private buffer = ''
  constructor() {
    super()
    this.process.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''
      lines.forEach(line => this.dispatchEvent(new MessageEvent('message', { data: line })))
    })
    this.process.on('error', () => this.dispatchEvent(new Event('error')))
    this.process.stderr.resume()
  }
  postMessage(message: string) { if (this.process.stdin.writable) this.process.stdin.write(`${message}\n`) }
  terminate() { this.process.kill() }
}

export function installRatingEngine() {
  Object.assign(globalThis, { Worker: RatingWorker, document: { baseURI: 'http://localhost/' } })
}
