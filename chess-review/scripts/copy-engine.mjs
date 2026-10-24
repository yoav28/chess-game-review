import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const packageDirectory = dirname(require.resolve('stockfish/package.json'))
const publicDirectory = fileURLToPath(new URL('../public/engine/', import.meta.url))
await mkdir(publicDirectory, { recursive: true })
for (const file of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  await copyFile(join(packageDirectory, 'bin', file), join(publicDirectory, file))
}
await copyFile(join(packageDirectory, 'Copying.txt'), join(publicDirectory, 'COPYING.txt'))
const licenseDirectory = fileURLToPath(new URL('../public/licenses/', import.meta.url))
await mkdir(licenseDirectory, { recursive: true })
await copyFile(join(dirname(require.resolve('chessops/chess')), '..', '..', 'LICENSE.txt'), join(licenseDirectory, 'CHESSOPS-COPYING.txt'))
