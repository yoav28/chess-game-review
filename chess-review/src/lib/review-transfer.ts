import type { GameReview } from './review'
import { transferDate, validateTransferredReview } from './review-transfer-validation'

export const maxReviewTransferBytes = 12 * 1024 * 1024
const format = 'open-file-review'

export function parseReviewTransfer(source: string): GameReview {
  if (new TextEncoder().encode(source).byteLength > maxReviewTransferBytes) throw new Error('Review files must be 12 MB or smaller.')
  let parsed: unknown
  try { parsed = JSON.parse(source) } catch { throw new Error('This is not a valid JSON review file.') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Choose an Open File review export.')
  const envelope = parsed as Record<string, unknown>
  if (envelope.format !== format || envelope.formatVersion !== 1 || Object.keys(envelope).some(key => !['format', 'formatVersion', 'exportedAt', 'review'].includes(key))) throw new Error('This review export format or version is not supported.')
  transferDate(envelope.exportedAt, 'export date')
  try { return { ...validateTransferredReview(envelope.review), importedAt: new Date().toISOString() } } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'This review file contains invalid data.')
  }
}

export function serializeReviewTransfer(review: GameReview, exportedAt = new Date().toISOString()): string {
  const source = JSON.stringify({ format, formatVersion: 1, exportedAt, review })
  parseReviewTransfer(source)
  return source
}

export function reviewTransferFilename(review: GameReview): string {
  const safe = (value: string) => value.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'player'
  return `${safe(review.white)}-${safe(review.black)}-review.open-file.json`
}
