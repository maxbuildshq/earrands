import { timeToMinutes, type TimedSet } from './timetable'

/**
 * Two sets clash if they're on the same festival day and their time ranges intersect.
 * Uses after-midnight-aware minutes so a 23:00–00:30 set correctly overlaps a 00:00–01:00 set.
 */
export function setsOverlap(a: TimedSet, b: TimedSet): boolean {
  if (a.day !== b.day) return false
  if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) return false
  const aStart = timeToMinutes(a.start_time)
  const aEnd = timeToMinutes(a.end_time)
  const bStart = timeToMinutes(b.start_time)
  const bEnd = timeToMinutes(b.end_time)
  return aStart < bEnd && bStart < aEnd
}

/** Ids of every set that clashes with at least one other set in the list. */
export function findConflictIds<T extends { id: string } & TimedSet>(sets: T[]): Set<string> {
  const ids = new Set<string>()
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      if (setsOverlap(sets[i], sets[j])) {
        ids.add(sets[i].id)
        ids.add(sets[j].id)
      }
    }
  }
  return ids
}
