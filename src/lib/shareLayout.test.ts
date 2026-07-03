import { describe, it, expect } from 'vitest'
import { computeSetTiers, paginateSets, DAY_HEADER_HEIGHT, MIDNIGHT_DIVIDER_HEIGHT } from './shareLayout.js'
import type { RowMeasure } from './shareLayout.js'
import type { SetWithStage } from '../types/database.js'

let seq = 0
function makeSet(day: string, opts: { followers?: (number | null)[]; time?: string; id?: string } = {}): SetWithStage {
  const id = opts.id ?? `set-${++seq}`
  return {
    id,
    artist_name: id,
    day,
    start_time: opts.time ?? null,
    set_artists: (opts.followers ?? [null]).map(f => ({ artists: { soundcloud_followers: f } })),
  } as unknown as SetWithStage
}

describe('computeSetTiers', () => {
  it('assigns standard to every set when no follower data exists', () => {
    const sets = [makeSet('2026-07-10'), makeSet('2026-07-10'), makeSet('2026-07-11')]
    const tiers = computeSetTiers(sets)
    for (const s of sets) expect(tiers.get(s.id)).toBe('standard')
  })

  it('assigns standard when all follower counts are equal (no relative signal)', () => {
    const sets = [makeSet('2026-07-10', { followers: [5000] }), makeSet('2026-07-10', { followers: [5000] })]
    const tiers = computeSetTiers(sets)
    for (const s of sets) expect(tiers.get(s.id)).toBe('standard')
  })

  it('splits two distinct levels into headliner and standard', () => {
    const big = makeSet('2026-07-10', { followers: [100_000] })
    const small = makeSet('2026-07-10', { followers: [1_000] })
    const tiers = computeSetTiers([big, small])
    expect(tiers.get(big.id)).toBe('headliner')
    expect(tiers.get(small.id)).toBe('standard')
  })

  it('separates three clear bands into three tiers', () => {
    const h1 = makeSet('d', { followers: [1_000_000] })
    const h2 = makeSet('d', { followers: [900_000] })
    const b1 = makeSet('d', { followers: [50_000] })
    const b2 = makeSet('d', { followers: [40_000] })
    const s1 = makeSet('d', { followers: [1_000] })
    const s2 = makeSet('d', { followers: [900] })
    const tiers = computeSetTiers([h1, h2, b1, b2, s1, s2])
    expect(tiers.get(h1.id)).toBe('headliner')
    expect(tiers.get(h2.id)).toBe('headliner')
    expect(tiers.get(b1.id)).toBe('big')
    expect(tiers.get(b2.id)).toBe('big')
    expect(tiers.get(s1.id)).toBe('standard')
    expect(tiers.get(s2.id)).toBe('standard')
  })

  it('uses the largest follower count across a set’s artists', () => {
    const b2b = makeSet('d', { followers: [500, 200_000] })
    const solo = makeSet('d', { followers: [1_000] })
    const tiers = computeSetTiers([b2b, solo])
    expect(tiers.get(b2b.id)).toBe('headliner')
  })

  it('keeps sets without data at standard even among tiered sets', () => {
    const known = makeSet('d', { followers: [200_000] })
    const unknown = makeSet('d')
    const other = makeSet('d', { followers: [1_000] })
    const tiers = computeSetTiers([known, unknown, other])
    expect(tiers.get(unknown.id)).toBe('standard')
    expect(tiers.get(known.id)).toBe('headliner')
  })
})

describe('paginateSets', () => {
  // 100px rows in one column, 60px rows in two columns (narrower ⇒ cheaper scale).
  const rowH: RowMeasure = (_id, cols) => (cols === 1 ? 100 : 60)

  it('offers a single one-column page when everything fits', () => {
    const sets = [makeSet('2026-07-10'), makeSet('2026-07-10'), makeSet('2026-07-10')]
    const { single, perDay, grouped } = paginateSets(sets, rowH, 300)
    expect(single).toHaveLength(1)
    expect(single![0].sets).toHaveLength(3)
    expect(single![0].cols).toBe(1)
    expect(perDay).toHaveLength(1)
    expect(grouped).toHaveLength(1)
  })

  it('uses a second column before splitting to a new page', () => {
    // 6 sets: one column holds 3 (300/100); two columns hold 5 per column (300/60).
    const sets = [...Array(6)].map(() => makeSet('2026-07-10'))
    const { single, perDay } = paginateSets(sets, rowH, 300)
    expect(single).toHaveLength(1)
    expect(single![0].cols).toBe(2)
    expect(perDay).toHaveLength(1)
    expect(perDay[0].cols).toBe(2)
  })

  it('drops the single option when the selection overflows two columns', () => {
    // 11 sets à 60px in 2×300px columns (capacity 10) do not fit.
    const sets = [...Array(11)].map(() => makeSet('2026-07-10'))
    const { single, perDay } = paginateSets(sets, rowH, 300)
    expect(single).toBeNull()
    expect(perDay.length).toBeGreaterThan(1)
  })

  it('counts day headers on multi-day pages only', () => {
    // Two days × 2 sets. One column: 2×(64+200)=528 > 500 as multi-day,
    // but each day alone (200, no header) fits ⇒ per-day pages are 1-col.
    const sets = [makeSet('2026-07-10'), makeSet('2026-07-10'), makeSet('2026-07-11'), makeSet('2026-07-11')]
    const twoColUnfriendly: RowMeasure = () => 200 // same in both column counts
    const { perDay, grouped } = paginateSets(sets, twoColUnfriendly, 500)
    expect(perDay).toHaveLength(2)
    expect(perDay.every(p => p.cols === 1)).toBe(true)
    // Grouped keeps both days on one page by spilling into the second column.
    expect(grouped).toHaveLength(1)
    expect(grouped[0].cols).toBe(2)
    expect(DAY_HEADER_HEIGHT).toBe(64)
  })

  it('groups consecutive days while they fit and splits oversized days', () => {
    // 3 days × 4 sets à 100/60px, body 240: a day alone fits 2-col (4×60=240),
    // two days (8 sets + headers) do not.
    const sets = [...Array(3)].flatMap((_, d) =>
      [...Array(4)].map(() => makeSet(`2026-07-1${d}`)))
    const { grouped, perDay } = paginateSets(sets, rowH, 240)
    expect(grouped.map(p => p.days.length)).toEqual([1, 1, 1])
    expect(perDay).toHaveLength(3)
  })

  it('splits an oversized day across two-column pages', () => {
    // 18 sets à 60px, body 240 ⇒ 4 rows per column, 8 per page ⇒ 8/8/2.
    const sets = [...Array(18)].map(() => makeSet('2026-07-10'))
    const { perDay } = paginateSets(sets, rowH, 240)
    expect(perDay.map(p => p.sets.length)).toEqual([8, 8, 2])
    expect(perDay[0].cols).toBe(2)
    // Final short chunk fits one column again.
    expect(perDay[2].cols).toBe(1)
  })

  it('restates the day header at the top of a continued column on multi-day pages', () => {
    // Day 1 (3 sets) + day 2 (1 set), rows 100px, body 300. Two columns would
    // fit only if the continued day-1 column skipped its repeated header —
    // since column tops always restate the day, the days split into two pages.
    const flat: RowMeasure = () => 100
    const sets = [
      makeSet('2026-07-10'), makeSet('2026-07-10'), makeSet('2026-07-10'),
      makeSet('2026-07-11'),
    ]
    const { grouped } = paginateSets(sets, flat, 300)
    expect(grouped.map(p => p.days)).toEqual([['2026-07-10'], ['2026-07-11']])
  })

  it('reserves space for the after-midnight divider (ADR 003)', () => {
    const evening = makeSet('2026-07-10', { time: '23:00', id: 'evening' })
    const late = makeSet('2026-07-10', { time: '01:00', id: 'late' })
    const flat: RowMeasure = () => 100
    const exact = 200 + MIDNIGHT_DIVIDER_HEIGHT
    expect(paginateSets([evening, late], flat, exact).single![0].cols).toBe(1)
    expect(paginateSets([evening, late], flat, exact - 1).single![0].cols).toBe(2)
  })

  it('orders sets chronologically within a day, respecting the after-midnight cutoff', () => {
    const late = makeSet('2026-07-10', { time: '01:00', id: 'late' })
    const evening = makeSet('2026-07-10', { time: '23:00', id: 'evening' })
    const { perDay } = paginateSets([late, evening], rowH, 1000)
    expect(perDay[0].sets.map(s => s.id)).toEqual(['evening', 'late'])
  })
})
