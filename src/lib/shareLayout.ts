import { isAfterMidnight, toSortableTime } from './dates'
import type { SetWithStage } from '../types/database'

export type SetTier = 'headliner' | 'big' | 'standard'
export type SplitMode = 'perDay' | 'grouped' | 'single'
export type SchedulePage = { sets: SetWithStage[]; days: string[]; cols: 1 | 2 }

/** Row height for a set at a given column count — includes wrapping, so the renderer supplies it. */
export type RowMeasure = (setId: string, cols: 1 | 2) => number

export const DAY_HEADER_HEIGHT = 64
export const MIDNIGHT_DIVIDER_HEIGHT = 44

export type RowExtra = { type: 'day' | 'midnight'; height: number }

/**
 * Label row inserted above a set: a day header when the day changes on a
 * multi-day page, or the ADR-003 "AFTER MIDNIGHT" divider when a festival day
 * crosses midnight. Shared by the paginator and the renderer so heights agree.
 */
export function rowExtra(prev: SetWithStage | null, s: SetWithStage, multiDay: boolean): RowExtra | null {
  if (!prev || prev.day !== s.day) {
    return multiDay ? { type: 'day', height: DAY_HEADER_HEIGHT } : null
  }
  if (s.start_time && prev.start_time && isAfterMidnight(s.start_time) && !isAfterMidnight(prev.start_time)) {
    return { type: 'midnight', height: MIDNIGHT_DIVIDER_HEIGHT }
  }
  return null
}

/** Largest SoundCloud following across a set's artists, or null when no artist has data. */
function maxFollowers(set: SetWithStage): number | null {
  let max = 0
  for (const sa of set.set_artists ?? []) {
    const f = sa.artists?.soundcloud_followers
    if (f && f > max) max = f
  }
  return max > 0 ? max : null
}

/**
 * Assign a visual tier to every set, clustered relatively within this selection
 * (1D k-means on log10 of the set's max follower count). Sets without follower
 * data are always `standard`; if all values are equal there is no relative
 * signal, so everything stays `standard`.
 */
export function computeSetTiers(sets: SetWithStage[]): Map<string, SetTier> {
  const tiers = new Map<string, SetTier>()
  const valued: { id: string; v: number }[] = []
  for (const s of sets) {
    const f = maxFollowers(s)
    if (f === null) tiers.set(s.id, 'standard')
    else valued.push({ id: s.id, v: Math.log10(f) })
  }

  const distinct = [...new Set(valued.map(x => x.v))]
  const k = Math.min(3, distinct.length)
  if (k <= 1) {
    for (const { id } of valued) tiers.set(id, 'standard')
    return tiers
  }

  const lo = Math.min(...distinct)
  const hi = Math.max(...distinct)
  let centroids = k === 2 ? [lo, hi] : [lo, (lo + hi) / 2, hi]
  const nearest = (v: number) => {
    let best = 0
    for (let c = 1; c < centroids.length; c++) {
      if (Math.abs(v - centroids[c]) < Math.abs(v - centroids[best])) best = c
    }
    return best
  }
  for (let iter = 0; iter < 25; iter++) {
    const sums = centroids.map(() => 0)
    const counts = centroids.map(() => 0)
    for (const { v } of valued) {
      const c = nearest(v)
      sums[c] += v
      counts[c]++
    }
    const next = centroids.map((c, i) => (counts[i] ? sums[i] / counts[i] : c))
    if (next.every((c, i) => c === centroids[i])) break
    centroids = next
  }

  const byRank = centroids.map((c, i) => ({ c, i })).sort((a, b) => a.c - b.c)
  const rankTiers: SetTier[] = k === 2 ? ['standard', 'headliner'] : ['standard', 'big', 'headliner']
  const tierOf = new Map(byRank.map(({ i }, rank) => [i, rankTiers[rank]]))
  for (const { id, v } of valued) tiers.set(id, tierOf.get(nearest(v))!)
  return tiers
}

type DayBlock = { day: string; sets: SetWithStage[] }

function dayBlocks(sets: SetWithStage[]): DayBlock[] {
  const byDay = new Map<string, SetWithStage[]>()
  for (const s of sets) {
    const list = byDay.get(s.day) ?? []
    list.push(s)
    byDay.set(s.day, list)
  }
  return [...byDay.keys()].sort().map(day => ({
    day,
    // Chronological within the festival day — 01:00 sets belong after 23:00 ones.
    sets: byDay.get(day)!.sort((a, b) =>
      (a.start_time ? toSortableTime(a.start_time) : '').localeCompare(b.start_time ? toSortableTime(b.start_time) : ''),
    ),
  }))
}

/**
 * Label height at the top of a column: multi-day pages always restate the day
 * there (so a continued day keeps context and columns align at the top);
 * single-day pages only carry a midnight divider across the break.
 */
export function columnTopExtra(prev: SetWithStage | null, s: SetWithStage, multiDay: boolean): RowExtra | null {
  if (multiDay) return { type: 'day', height: DAY_HEADER_HEIGHT }
  return rowExtra(prev, s, false)
}

/**
 * Sequentially fill up to `cols` columns of `bodyHeight`. Day headers are only
 * drawn on pages spanning multiple days (single-day pages state the day in the
 * subtitle). Mirrored exactly by the renderer's placement loop.
 */
export function fitsCols(sets: SetWithStage[], multiDay: boolean, rowH: RowMeasure, bodyHeight: number, cols: 1 | 2): boolean {
  let col = 0
  let h = 0
  let prev: SetWithStage | null = null
  for (const s of sets) {
    let extra = (h === 0 ? columnTopExtra(prev, s, multiDay) : rowExtra(prev, s, multiDay))?.height ?? 0
    const rh = rowH(s.id, cols)
    if (h > 0 && h + extra + rh > bodyHeight) {
      col++
      h = 0
      if (col >= cols) return false
      extra = columnTopExtra(prev, s, multiDay)?.height ?? 0
    }
    h += extra + rh
    prev = s
  }
  return true
}

/** Column count for a page whose content is known to fit, preferring one column. */
function pageCols(sets: SetWithStage[], days: string[], rowH: RowMeasure, bodyHeight: number): 1 | 2 {
  return fitsCols(sets, days.length > 1, rowH, bodyHeight, 1) ? 1 : 2
}

/** Split one oversized day into two-column pages; each chunk page is single-day (no headers). */
function chunkDay(block: DayBlock, rowH: RowMeasure, bodyHeight: number): SchedulePage[] {
  const pages: SchedulePage[] = []
  let cur: SetWithStage[] = []
  let col = 0
  let h = 0
  let prev: SetWithStage | null = null
  for (const s of block.sets) {
    const extra = rowExtra(prev, s, false)?.height ?? 0
    const rh = rowH(s.id, 2) + extra
    if (h > 0 && h + rh > bodyHeight) {
      col++
      h = 0
      if (col >= 2) {
        pages.push({ sets: cur, days: [block.day], cols: 2 })
        cur = []
        col = 0
      }
    }
    cur.push(s)
    h += rh
    prev = s
  }
  if (cur.length) pages.push({ sets: cur, days: [block.day], cols: pageCols(cur, [block.day], rowH, bodyHeight) })
  return pages
}

function fitsPage(sets: SetWithStage[], days: string[], rowH: RowMeasure, bodyHeight: number): boolean {
  const multiDay = days.length > 1
  return fitsCols(sets, multiDay, rowH, bodyHeight, 1) || fitsCols(sets, multiDay, rowH, bodyHeight, 2)
}

/**
 * Compute the three split options for a selection. `single` is null when the
 * whole selection doesn't fit one page (two columns allowed). Oversized single
 * days split across pages in both `perDay` and `grouped`.
 */
export function paginateSets(
  sets: SetWithStage[],
  rowH: RowMeasure,
  bodyHeight: number,
): { perDay: SchedulePage[]; grouped: SchedulePage[]; single: SchedulePage[] | null } {
  const blocks = dayBlocks(sets)

  const perDay = blocks.flatMap(b =>
    fitsPage(b.sets, [b.day], rowH, bodyHeight)
      ? [{ sets: b.sets, days: [b.day], cols: pageCols(b.sets, [b.day], rowH, bodyHeight) }]
      : chunkDay(b, rowH, bodyHeight),
  )

  const grouped: SchedulePage[] = []
  let cur: { sets: SetWithStage[]; days: string[] } | null = null
  const flush = () => {
    if (cur) grouped.push({ ...cur, cols: pageCols(cur.sets, cur.days, rowH, bodyHeight) })
    cur = null
  }
  for (const b of blocks) {
    if (cur && fitsPage([...cur.sets, ...b.sets], [...cur.days, b.day], rowH, bodyHeight)) {
      cur.sets.push(...b.sets)
      cur.days.push(b.day)
    } else if (fitsPage(b.sets, [b.day], rowH, bodyHeight)) {
      flush()
      cur = { sets: [...b.sets], days: [b.day] }
    } else {
      flush()
      const chunks = chunkDay(b, rowH, bodyHeight)
      grouped.push(...chunks.slice(0, -1))
      const last = chunks[chunks.length - 1]
      cur = { sets: [...last.sets], days: [...last.days] }
    }
  }
  flush()

  const allDays = blocks.map(b => b.day)
  const allSets = blocks.flatMap(b => b.sets)
  const single: SchedulePage[] | null =
    allSets.length && fitsPage(allSets, allDays, rowH, bodyHeight)
      ? [{ sets: allSets, days: allDays, cols: pageCols(allSets, allDays, rowH, bodyHeight) }]
      : null

  return { perDay, grouped, single }
}
