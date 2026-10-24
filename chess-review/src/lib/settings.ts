import type { CoachProfile } from './coach'
import { defaultBoardAppearance, normalizeBoardAppearance, type BoardAppearance } from './board-appearance'
import { analysisTimeLimit, engineThreads } from '../engine/search-options'

export type Settings = BoardAppearance & {
  depth: number
  timeMs: number
  analysisLines: number
  analysisTimeMs: number
  analysisThreads: number
  reviewThreads: number
  sound: boolean
  arrowMode: 'best' | 'coach' | 'both' | 'none'
  showClassifications: boolean
  autoplayExplanation: boolean
  explanationDelayMs: number
  showCoachAvatar: boolean
  showRecommendations: boolean
  showSkills: boolean
  showTimeSpent: boolean
  highlight: 'all' | 'self' | 'opponent'
  coachDetail: 'concise' | 'detailed'
  coachProfile: CoachProfile
}

export const defaultSettings: Settings = {
  ...defaultBoardAppearance,
  depth: 16, timeMs: 500, analysisLines: 3, sound: false, arrowMode: 'best',
  analysisTimeMs: 5000, analysisThreads: 1, reviewThreads: 1,
  showClassifications: true, autoplayExplanation: true, explanationDelayMs: 1300,
  showCoachAvatar: true, showRecommendations: true, showSkills: true,
  showTimeSpent: true, highlight: 'all', coachDetail: 'detailed', coachProfile: 'clear',
}

function bounded(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.round(value))) : fallback
}

function choice<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? value as T : fallback
}

export function normalizeSettings(value: unknown): Settings {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const boolean = (key: keyof Settings) => typeof source[key] === 'boolean' ? source[key] as boolean : defaultSettings[key] as boolean
  const legacyArrows = typeof source.showArrows === 'boolean' ? source.showArrows ? 'best' : 'none' : defaultSettings.arrowMode
  return {
    ...normalizeBoardAppearance(source),
    depth: bounded(source.depth, defaultSettings.depth, 10, 22),
    timeMs: bounded(source.timeMs, defaultSettings.timeMs, 150, 5000),
    analysisLines: bounded(source.analysisLines, defaultSettings.analysisLines, 1, 5),
    analysisTimeMs: analysisTimeLimit(source.analysisTimeMs),
    analysisThreads: engineThreads(source.analysisThreads),
    reviewThreads: engineThreads(source.reviewThreads),
    sound: boolean('sound'),
    arrowMode: choice(source.arrowMode, ['best', 'coach', 'both', 'none'], legacyArrows),
    showClassifications: boolean('showClassifications'),
    autoplayExplanation: boolean('autoplayExplanation'),
    explanationDelayMs: bounded(source.explanationDelayMs, defaultSettings.explanationDelayMs, 500, 5000),
    showCoachAvatar: boolean('showCoachAvatar'),
    showRecommendations: boolean('showRecommendations'),
    showSkills: boolean('showSkills'),
    showTimeSpent: boolean('showTimeSpent'),
    highlight: choice(source.highlight, ['all', 'self', 'opponent'], defaultSettings.highlight),
    coachDetail: choice(source.coachDetail, ['concise', 'detailed'], defaultSettings.coachDetail),
    coachProfile: choice(source.coachProfile, ['clear', 'supportive', 'analyst'], defaultSettings.coachProfile),
  }
}

export function readSettings(storage?: Pick<Storage, 'getItem'>): Settings {
  try {
    const saved = (storage ?? localStorage).getItem('open-file-settings')
    return normalizeSettings(saved ? JSON.parse(saved) : null)
  } catch {
    return normalizeSettings(null)
  }
}
