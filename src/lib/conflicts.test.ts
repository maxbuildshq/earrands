import { describe, it, expect } from 'vitest'
import { setsOverlap, findConflictIds } from './conflicts'

describe('setsOverlap', () => {
  it('detects overlapping ranges on the same day', () => {
    expect(setsOverlap(
      { day: 'd', start_time: '22:00', end_time: '23:30' },
      { day: 'd', start_time: '23:00', end_time: '00:30' },
    )).toBe(true)
  })
  it('treats touching edges as no overlap', () => {
    expect(setsOverlap(
      { day: 'd', start_time: '22:00', end_time: '23:00' },
      { day: 'd', start_time: '23:00', end_time: '00:00' },
    )).toBe(false)
  })
  it('never clashes across different days', () => {
    expect(setsOverlap(
      { day: 'd1', start_time: '22:00', end_time: '23:30' },
      { day: 'd2', start_time: '22:30', end_time: '23:00' },
    )).toBe(false)
  })
  it('handles after-midnight overlap that a raw string compare would miss', () => {
    expect(setsOverlap(
      { day: 'd', start_time: '23:00', end_time: '00:30' },
      { day: 'd', start_time: '00:00', end_time: '01:00' },
    )).toBe(true)
  })
  it('returns false when a time is missing', () => {
    expect(setsOverlap(
      { day: 'd', start_time: '22:00', end_time: null },
      { day: 'd', start_time: '22:30', end_time: '23:00' },
    )).toBe(false)
  })
})

describe('findConflictIds', () => {
  it('returns ids of every clashing set, none for clear ones', () => {
    const sets = [
      { id: 'a', day: 'd', start_time: '22:00', end_time: '23:30' },
      { id: 'b', day: 'd', start_time: '23:00', end_time: '00:30' },
      { id: 'c', day: 'd', start_time: '01:00', end_time: '02:00' },
    ]
    const ids = findConflictIds(sets)
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(true)
    expect(ids.has('c')).toBe(false)
    expect(ids.size).toBe(2)
  })
})
