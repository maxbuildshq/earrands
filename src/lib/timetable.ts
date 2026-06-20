import { toSortableTime } from './dates'

/** Minimal time-bearing shape shared by the swimlane layout and conflict logic. */
export type TimedSet = {
  day: string
  start_time: string | null
  end_time: string | null
}

/** Minutes-from-midnight for an `HH:MM` time, after-midnight aware (`00:30` → 24:30 → 1470). */
export function timeToMinutes(time: string): number {
  const [h, m] = toSortableTime(time).split(':').map(Number)
  return h * 60 + m
}

export type DayBounds = { startMin: number; endMin: number }

/** A set is placeable on the timeline only if it has both times and a positive duration.
 *  (Some festivals store unannounced slots as 00:00–00:00; those are "untimed", not zero-length.) */
export function hasValidTime(set: TimedSet): boolean {
  if (!set.start_time || !set.end_time) return false
  return timeToMinutes(set.end_time) > timeToMinutes(set.start_time)
}

/** Earliest start and latest end (after-midnight-aware minutes) across placeable sets, or null if none. */
export function getDayBounds(sets: TimedSet[]): DayBounds | null {
  let startMin = Infinity
  let endMin = -Infinity
  for (const s of sets) {
    if (!hasValidTime(s)) continue
    startMin = Math.min(startMin, timeToMinutes(s.start_time!))
    endMin = Math.max(endMin, timeToMinutes(s.end_time!))
  }
  if (startMin === Infinity) return null
  return { startMin, endMin }
}

/**
 * Calendar-style sub-row packing for the sets on a single stage lane: sets that overlap in time
 * get distinct sub-rows so they stack vertically instead of overprinting (e.g. a curated takeover
 * block wrapping its guest sets). Returns each id → { row, rows }, where `rows` is the sub-row count
 * for that set's overlap cluster (1 when it doesn't overlap anything).
 */
export function packLane<T extends { id: string } & TimedSet>(
  laneSets: T[],
): Map<string, { row: number; rows: number }> {
  const sorted = laneSets
    .filter(hasValidTime)
    .slice()
    .sort((a, b) =>
      timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!) ||
      timeToMinutes(a.end_time!) - timeToMinutes(b.end_time!),
    )
  const result = new Map<string, { row: number; rows: number }>()
  let i = 0
  while (i < sorted.length) {
    let clusterEnd = timeToMinutes(sorted[i].end_time!)
    const cluster = [sorted[i]]
    let j = i + 1
    while (j < sorted.length && timeToMinutes(sorted[j].start_time!) < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, timeToMinutes(sorted[j].end_time!))
      cluster.push(sorted[j])
      j++
    }
    const colEnds: number[] = []
    const col = new Map<string, number>()
    for (const s of cluster) {
      const start = timeToMinutes(s.start_time!)
      let placed = colEnds.findIndex(e => e <= start)
      if (placed === -1) { placed = colEnds.length; colEnds.push(0) }
      colEnds[placed] = timeToMinutes(s.end_time!)
      col.set(s.id, placed)
    }
    for (const s of cluster) result.set(s.id, { row: col.get(s.id)!, rows: colEnds.length })
    i = j
  }
  return result
}

/** Pixel position of a set on the time axis. Null for sets missing either time. */
export function setPosition(
  set: TimedSet,
  bounds: DayBounds,
  pxPerMin: number,
): { left: number; width: number } | null {
  if (!set.start_time || !set.end_time) return null
  const start = timeToMinutes(set.start_time)
  const end = timeToMinutes(set.end_time)
  return {
    left: (start - bounds.startMin) * pxPerMin,
    width: (end - start) * pxPerMin,
  }
}

/** Whole-hour tick marks (in minutes) spanning the bounds, for the time ruler. */
export function getHourTicks(bounds: DayBounds): number[] {
  const first = Math.floor(bounds.startMin / 60) * 60
  const last = Math.ceil(bounds.endMin / 60) * 60
  const ticks: number[] = []
  for (let m = first; m <= last; m += 60) ticks.push(m)
  return ticks
}

/** Wall-clock `HH:MM` label for an after-midnight-aware minute value (24:00 wraps back to 00:00). */
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
