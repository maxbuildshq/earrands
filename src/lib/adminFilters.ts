import type { Artist } from '../types/database'

// ── Confidence grouping (shared by Enrichment Review + Artists list) ─────────

export const LEVEL_ORDER = { high: 0, medium: 1, low: 2 } as const
export type Level = keyof typeof LEVEL_ORDER

export const CONFIDENCE_FILTERS = ['all', 'high', 'medium', 'low', 'unscored'] as const
export type ConfidenceFilter = (typeof CONFIDENCE_FILTERS)[number]

// Aggregated confidence: the weakest identity-critical field (SC, image, IG)
// sets the group; per-field chips carry the detail (ADR 011)
export function aggregateLevel(a: Pick<Artist, 'enrichment_confidence'>): Level | 'unscored' {
  const fc = a.enrichment_confidence
  if (!fc) return 'unscored'
  const levels = ['soundcloud', 'image', 'instagram']
    .map(k => fc[k]?.level)
    .filter((l): l is Level => !!l)
  if (levels.length === 0) return 'unscored'
  return levels.reduce((worst, l) => LEVEL_ORDER[l] > LEVEL_ORDER[worst] ? l : worst)
}

// Fields that can be re-enriched (map to enrich --fields=)
export const ENRICH_FIELDS = ['image', 'soundcloud', 'instagram', 'bandcamp', 'discogs', 'location', 'followers', 'bio'] as const

export const PAGE_SIZES = [50, 100, 200, 300] as const

// ── Session-remembered festival filter (shared key across all admin pages) ───

const FESTIVAL_FILTER_KEY = 'admin-festival-filter'

export function rememberedFestival(): string {
  try {
    return sessionStorage.getItem(FESTIVAL_FILTER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberFestival(id: string) {
  try {
    sessionStorage.setItem(FESTIVAL_FILTER_KEY, id)
  } catch { /* private-mode quota — filter just won't persist */ }
}

// Higher-contrast placeholder than the default border grey — must be readable
// at a glance (same reasoning as ADR 001, applied to admin inputs)
export const KEYWORDS_INPUT_CLASS =
  'bg-transparent border-b border-border text-text-primary font-mono text-xs w-40 outline-none placeholder:text-text-primary placeholder:opacity-60 focus:border-accent'
