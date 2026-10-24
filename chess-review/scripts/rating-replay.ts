import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { validateRatingPilot } from '../src/lib/rating-calibration'

const path = resolve(process.argv[2] ?? 'src/data/rating-pilot-v1.json')
const dataset = JSON.parse(await readFile(path, 'utf8'))
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
assert.equal(digest(JSON.stringify(dataset.observations)), dataset.report.observationsSha256)
assert.equal(digest(JSON.stringify(dataset.sourceManifest, null, 2)), dataset.report.inputManifestSha256)
assert.equal(digest(await readFile(new URL('../src/lib/rating-calibration.ts', import.meta.url))), dataset.report.calibrationSourceSha256)
const validation = validateRatingPilot(dataset.observations)
assert.deepEqual(validation, dataset.report.validation)
process.stdout.write(JSON.stringify({ verified: true, file: path, validation }, null, 2) + '\n')
