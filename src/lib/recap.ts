import { toSortableTime } from './dates'
import type { Festival, SetWithStage, UserRating } from '../types/database'
import type { SetTier } from './shareLayout'

export type RecapDataLevel = 'ratings' | 'picks' | 'none'

export type RecapStats = {
  level: RecapDataLevel
  lovedSets: SetWithStage[]
  unexpectedFinds: SetWithStage[]
  favorites: SetWithStage[]
  setsCount: number
  stagesCount: number
  daysAttended: number
}

/** How long after a festival ends the recap stays surfaced. */
export const RECAP_WINDOW_DAYS = 60

/** Moment the festival is over: end_date + 1 day at the 07:00 after-midnight cutoff (ADR 003). */
function festivalEnd(festival: Festival): Date {
  const end = new Date(festival.end_date + 'T00:00:00')
  end.setDate(end.getDate() + 1)
  end.setHours(7, 0, 0, 0)
  return end
}

export function isEnded(festival: Festival, now: Date = new Date()): boolean {
  return now > festivalEnd(festival)
}

export function isInRecapWindow(festival: Festival, now: Date = new Date()): boolean {
  const end = festivalEnd(festival)
  const windowEnd = new Date(end)
  windowEnd.setDate(windowEnd.getDate() + RECAP_WINDOW_DAYS)
  return now > end && now < windowEnd
}

const chrono = (a: SetWithStage, b: SetWithStage) =>
  a.day.localeCompare(b.day) ||
  (a.start_time ? toSortableTime(a.start_time) : '').localeCompare(b.start_time ? toSortableTime(b.start_time) : '')

/**
 * Derive the recap card content from data the app already has. Music sets
 * only; ratings arrive cross-festival, so everything is scoped through this
 * festival's set list. `highlightSetIds` is the iteration-2 seam: those sets
 * sort first among favorites.
 */
export function buildRecapStats(opts: {
  sets: SetWithStage[]
  planSetIds: Set<string>
  ratings: UserRating[]
  highlightSetIds?: Set<string>
}): RecapStats {
  const { sets, planSetIds, ratings, highlightSetIds } = opts
  const byId = new Map(sets.filter(s => s.is_music_set).map(s => [s.id, s]))

  const pickedSets = [...byId.values()].filter(s => planSetIds.has(s.id)).sort(chrono)
  const lovedSets = ratings
    .filter(r => r.rating === 1)
    .flatMap(r => byId.get(r.set_id) ?? [])
    .sort(chrono)
  const unexpectedFinds = lovedSets.filter(s => !planSetIds.has(s.id))

  const level: RecapDataLevel = lovedSets.length ? 'ratings' : pickedSets.length ? 'picks' : 'none'

  let favorites = level === 'ratings' ? lovedSets : pickedSets
  if (highlightSetIds?.size) {
    favorites = [...favorites].sort((a, b) =>
      Number(highlightSetIds.has(b.id)) - Number(highlightSetIds.has(a.id)) || chrono(a, b))
  }

  const attended = new Map(pickedSets.map(s => [s.id, s]))
  for (const s of lovedSets) attended.set(s.id, s)
  const attendedSets = [...attended.values()]

  return {
    level,
    lovedSets,
    unexpectedFinds,
    favorites,
    setsCount: attendedSets.length,
    stagesCount: new Set(attendedSets.map(s => s.stage_id).filter(Boolean)).size,
    daysAttended: new Set(attendedSets.map(s => s.day)).size,
  }
}

const TIER_RANK: Record<SetTier, number> = { headliner: 0, big: 1, standard: 2 }

/** Trim to `max` sets, keeping the biggest names (tier, then chronological); display order stays chronological. */
export function capByTier(sets: SetWithStage[], tiers: Map<string, SetTier>, max: number): SetWithStage[] {
  if (sets.length <= max) return sets
  return [...sets]
    .sort((a, b) =>
      TIER_RANK[tiers.get(a.id) ?? 'standard'] - TIER_RANK[tiers.get(b.id) ?? 'standard'] || chrono(a, b))
    .slice(0, max)
    .sort(chrono)
}
