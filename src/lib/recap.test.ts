import { describe, it, expect } from 'vitest'
import { buildRecapStats, capByTier, isEnded, isInRecapWindow, RECAP_WINDOW_DAYS } from './recap.js'
import type { SetTier } from './shareLayout.js'
import type { Festival, SetWithStage, UserRating } from '../types/database.js'

let seq = 0
function makeSet(day: string, opts: { time?: string; stage?: string; music?: boolean; id?: string } = {}): SetWithStage {
  const id = opts.id ?? `set-${++seq}`
  return {
    id,
    artist_name: id,
    day,
    start_time: opts.time ?? null,
    stage_id: opts.stage ?? 'stage-1',
    is_music_set: opts.music ?? true,
  } as unknown as SetWithStage
}

function makeRating(set_id: string, rating: -1 | 1): UserRating {
  return { id: `r-${set_id}`, user_id: 'u', set_id, rating, created_at: '' }
}

function makeFestival(end_date: string): Festival {
  return { end_date, start_date: end_date } as unknown as Festival
}

describe('isEnded / isInRecapWindow', () => {
  const fest = makeFestival('2026-07-06')

  it('is not ended before the 07:00 cutoff on the day after end_date (ADR 003)', () => {
    expect(isEnded(fest, new Date('2026-07-07T06:00:00'))).toBe(false)
  })

  it('is ended after the cutoff', () => {
    expect(isEnded(fest, new Date('2026-07-07T08:00:00'))).toBe(true)
  })

  it('window opens at end and closes RECAP_WINDOW_DAYS later', () => {
    expect(isInRecapWindow(fest, new Date('2026-07-07T06:00:00'))).toBe(false)
    expect(isInRecapWindow(fest, new Date('2026-07-08T12:00:00'))).toBe(true)
    const past = new Date('2026-07-07T07:00:00')
    past.setDate(past.getDate() + RECAP_WINDOW_DAYS + 1)
    expect(isInRecapWindow(fest, past)).toBe(false)
  })
})

describe('buildRecapStats', () => {
  it('level none without picks or thumbs-up ratings', () => {
    const sets = [makeSet('2026-07-01')]
    const down = buildRecapStats({ sets, planSetIds: new Set(), ratings: [makeRating(sets[0].id, -1)] })
    expect(down.level).toBe('none')
    expect(down.favorites).toEqual([])
  })

  it('level picks when only picks exist; favorites are the picked sets', () => {
    const a = makeSet('2026-07-01', { time: '22:00' })
    const b = makeSet('2026-07-01', { time: '20:00' })
    const stats = buildRecapStats({ sets: [a, b], planSetIds: new Set([a.id, b.id]), ratings: [] })
    expect(stats.level).toBe('picks')
    expect(stats.favorites.map(s => s.id)).toEqual([b.id, a.id]) // chronological
    expect(stats.unexpectedFinds).toEqual([])
  })

  it('level ratings: favorites are loved sets, unexpected finds are loved-but-not-picked', () => {
    const planned = makeSet('2026-07-01')
    const surprise = makeSet('2026-07-02')
    const stats = buildRecapStats({
      sets: [planned, surprise],
      planSetIds: new Set([planned.id]),
      ratings: [makeRating(planned.id, 1), makeRating(surprise.id, 1)],
    })
    expect(stats.level).toBe('ratings')
    expect(stats.favorites.map(s => s.id)).toEqual([planned.id, surprise.id])
    expect(stats.unexpectedFinds.map(s => s.id)).toEqual([surprise.id])
  })

  it('ignores ratings from other festivals (unknown set ids)', () => {
    const here = makeSet('2026-07-01')
    const stats = buildRecapStats({
      sets: [here],
      planSetIds: new Set([here.id]),
      ratings: [makeRating('other-festival-set', 1)],
    })
    expect(stats.level).toBe('picks')
  })

  it('excludes non-music sets everywhere', () => {
    const music = makeSet('2026-07-01')
    const yoga = makeSet('2026-07-01', { music: false, stage: 'stage-2' })
    const stats = buildRecapStats({
      sets: [music, yoga],
      planSetIds: new Set([music.id, yoga.id]),
      ratings: [makeRating(yoga.id, 1)],
    })
    expect(stats.level).toBe('picks')
    expect(stats.setsCount).toBe(1)
    expect(stats.stagesCount).toBe(1)
  })

  it('counts sets, stages and days over picks ∪ loved', () => {
    const picked = makeSet('2026-07-01', { stage: 'a' })
    const both = makeSet('2026-07-01', { stage: 'b' })
    const lovedOnly = makeSet('2026-07-02', { stage: 'b' })
    const stats = buildRecapStats({
      sets: [picked, both, lovedOnly],
      planSetIds: new Set([picked.id, both.id]),
      ratings: [makeRating(both.id, 1), makeRating(lovedOnly.id, 1)],
    })
    expect(stats.setsCount).toBe(3)
    expect(stats.stagesCount).toBe(2)
    expect(stats.daysAttended).toBe(2)
  })

  it('sorts highlighted sets first among favorites (iteration-2 seam)', () => {
    const a = makeSet('2026-07-01', { time: '20:00' })
    const b = makeSet('2026-07-01', { time: '22:00' })
    const stats = buildRecapStats({
      sets: [a, b],
      planSetIds: new Set(),
      ratings: [makeRating(a.id, 1), makeRating(b.id, 1)],
      highlightSetIds: new Set([b.id]),
    })
    expect(stats.favorites.map(s => s.id)).toEqual([b.id, a.id])
  })

  it('after-midnight sets sort after evening sets within a festival day (ADR 003)', () => {
    const late = makeSet('2026-07-01', { time: '01:00' })
    const evening = makeSet('2026-07-01', { time: '23:00' })
    const stats = buildRecapStats({ sets: [late, evening], planSetIds: new Set([late.id, evening.id]), ratings: [] })
    expect(stats.favorites.map(s => s.id)).toEqual([evening.id, late.id])
  })
})

describe('capByTier', () => {
  it('returns sets untouched when under the cap', () => {
    const sets = [makeSet('2026-07-01'), makeSet('2026-07-02')]
    expect(capByTier(sets, new Map(), 5)).toBe(sets)
  })

  it('keeps the biggest names but displays chronologically', () => {
    const s1 = makeSet('2026-07-01', { time: '18:00' })
    const head = makeSet('2026-07-01', { time: '23:00' })
    const s2 = makeSet('2026-07-02', { time: '20:00' })
    const tiers = new Map<string, SetTier>([[head.id, 'headliner'], [s1.id, 'standard'], [s2.id, 'standard']])
    const capped = capByTier([s1, head, s2], tiers, 2)
    expect(capped.map(s => s.id)).toEqual([s1.id, head.id]) // headliner kept + earliest standard, chrono order
  })
})
