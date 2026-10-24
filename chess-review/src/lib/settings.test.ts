import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultSettings, normalizeSettings, readSettings } from './settings'

test('stored legacy arrows migrate without dropping engine and sound preferences', () => {
  const old = { depth: 19, timeMs: 1500, sound: true, showArrows: false }
  assert.deepEqual(normalizeSettings(old), { ...defaultSettings, depth: 19, timeMs: 1500, sound: true, arrowMode: 'none' })
  assert.equal(normalizeSettings({ showArrows: true }).arrowMode, 'best')
  assert.equal(normalizeSettings({ showArrows: false, arrowMode: 'both' }).arrowMode, 'both')
  assert.equal(Object.hasOwn(normalizeSettings(old), 'showArrows'), false)
  assert.deepEqual(old, { depth: 19, timeMs: 1500, sound: true, showArrows: false })
})

test('corrupt numeric preferences are finite, rounded and bounded without coercion', () => {
  assert.equal(normalizeSettings({ depth: 1000 }).depth, 22)
  assert.equal(normalizeSettings({ depth: -1 }).depth, 10)
  assert.equal(normalizeSettings({ depth: 17.8 }).depth, 18)
  assert.equal(normalizeSettings({ depth: '20' }).depth, 16)
  assert.equal(normalizeSettings({ timeMs: Infinity }).timeMs, 500)
  assert.equal(normalizeSettings({ timeMs: -100 }).timeMs, 150)
  assert.equal(normalizeSettings({ timeMs: 10000 }).timeMs, 5000)
  assert.equal(normalizeSettings({ explanationDelayMs: NaN }).explanationDelayMs, 1300)
  assert.equal(normalizeSettings({ explanationDelayMs: -1 }).explanationDelayMs, 500)
  assert.equal(normalizeSettings({ explanationDelayMs: 9000 }).explanationDelayMs, 5000)
  assert.equal(normalizeSettings({ analysisLines: -1 }).analysisLines, 1)
  assert.equal(normalizeSettings({ analysisLines: 20 }).analysisLines, 5)
  assert.equal(normalizeSettings({ analysisLines: 3.8 }).analysisLines, 4)
  assert.equal(normalizeSettings({ analysisLines: '5' }).analysisLines, 3)
  assert.equal(normalizeSettings({ analysisLines: Infinity }).analysisLines, 3)
})

test('only explicit supported enum and boolean settings survive normalization', () => {
  const normalized = normalizeSettings({
    arrowMode: 'coach', highlight: 'opponent', coachDetail: 'concise', coachProfile: 'analyst',
    showClassifications: false, autoplayExplanation: false, showCoachAvatar: false,
    showRecommendations: false, showSkills: false, showTimeSpent: false, unknown: true,
  })
  assert.equal(normalized.arrowMode, 'coach')
  assert.equal(normalized.highlight, 'opponent')
  assert.equal(normalized.coachDetail, 'concise')
  assert.equal(normalized.coachProfile, 'analyst')
  for (const key of ['showClassifications', 'autoplayExplanation', 'showCoachAvatar', 'showRecommendations', 'showSkills', 'showTimeSpent'] as const) assert.equal(normalized[key], false)
  assert.equal(Object.hasOwn(normalized, 'unknown'), false)
  assert.deepEqual(normalizeSettings({ arrowMode: 'all', highlight: 'everyone', coachDetail: true, coachProfile: 'famous-player', sound: 'false', showSkills: 0 }), defaultSettings)
})

test('empty, invalid and inaccessible local storage yield independent safe defaults', () => {
  for (const saved of [null, '', '{', 'null', '[]', 'true', '"settings"']) {
    const settings = readSettings({ getItem: () => saved })
    assert.deepEqual(settings, defaultSettings)
    assert.notEqual(settings, defaultSettings)
  }
  assert.deepEqual(readSettings({ getItem: () => { throw new Error('Denied') } }), defaultSettings)
  assert.deepEqual(readSettings({ getItem: key => {
    assert.equal(key, 'open-file-settings')
    return '{"showArrows":false,"depth":21,"showSkills":false}'
  } }), { ...defaultSettings, depth: 21, arrowMode: 'none', showSkills: false })
  assert.deepEqual(readSettings({ getItem: () => '{"coachProfile":"supportive","analysisLines":5}' }), { ...defaultSettings, coachProfile: 'supportive', analysisLines: 5 })
})
