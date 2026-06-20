import { describe, it, expect } from 'vitest'
import { timeToMinutes, getDayBounds, setPosition, getHourTicks, minutesToLabel, packLane } from './timetable'

describe('timeToMinutes', () => {
  it('parses a normal time', () => {
    expect(timeToMinutes('14:30')).toBe(870)
  })
  it('shifts after-midnight times past 24h', () => {
    expect(timeToMinutes('00:30')).toBe(1470)
    expect(timeToMinutes('01:00')).toBe(1500)
  })
  it('treats the 07:00 cutoff as same-day', () => {
    expect(timeToMinutes('07:00')).toBe(420)
  })
})

describe('getDayBounds', () => {
  it('spans earliest start to latest end across midnight', () => {
    const sets = [
      { day: 'd', start_time: '14:00', end_time: '15:30' },
      { day: 'd', start_time: '22:30', end_time: '00:00' },
      { day: 'd', start_time: '23:00', end_time: '01:00' },
    ]
    expect(getDayBounds(sets)).toEqual({ startMin: 840, endMin: 1500 })
  })
  it('ignores sets missing times', () => {
    const sets = [
      { day: 'd', start_time: null, end_time: null },
      { day: 'd', start_time: '20:00', end_time: '21:00' },
    ]
    expect(getDayBounds(sets)).toEqual({ startMin: 1200, endMin: 1260 })
  })
  it('returns null when no sets have times', () => {
    expect(getDayBounds([{ day: 'd', start_time: null, end_time: null }])).toBeNull()
    expect(getDayBounds([])).toBeNull()
  })
})

describe('setPosition', () => {
  const bounds = { startMin: 840, endMin: 1500 }
  it('positions a daytime set', () => {
    expect(setPosition({ day: 'd', start_time: '15:00', end_time: '16:00' }, bounds, 2))
      .toEqual({ left: 120, width: 120 })
  })
  it('positions an after-midnight set', () => {
    expect(setPosition({ day: 'd', start_time: '23:00', end_time: '00:30' }, bounds, 1))
      .toEqual({ left: 540, width: 90 })
  })
  it('returns null when a time is missing', () => {
    expect(setPosition({ day: 'd', start_time: '23:00', end_time: null }, bounds, 1)).toBeNull()
  })
})

describe('getHourTicks', () => {
  it('snaps to whole hours covering the bounds', () => {
    const ticks = getHourTicks({ startMin: 850, endMin: 1490 })
    expect(ticks[0]).toBe(840)
    expect(ticks[ticks.length - 1]).toBe(1500)
    expect(ticks).toHaveLength(12)
  })
})

describe('packLane', () => {
  it('keeps non-overlapping sets on a single row', () => {
    const m = packLane([
      { id: 'a', day: 'd', start_time: '12:00', end_time: '13:00' },
      { id: 'b', day: 'd', start_time: '13:00', end_time: '14:00' },
    ])
    expect(m.get('a')).toEqual({ row: 0, rows: 1 })
    expect(m.get('b')).toEqual({ row: 0, rows: 1 })
  })
  it('stacks an overlapping takeover and its guest into two rows', () => {
    const m = packLane([
      { id: 'umbrella', day: 'd', start_time: '11:00', end_time: '14:00' },
      { id: 'guest', day: 'd', start_time: '11:30', end_time: '13:30' },
    ])
    expect(m.get('umbrella')!.rows).toBe(2)
    expect(m.get('guest')!.rows).toBe(2)
    expect(m.get('umbrella')!.row).not.toBe(m.get('guest')!.row)
  })
  it('reuses a freed row once an earlier set ends', () => {
    const m = packLane([
      { id: 'a', day: 'd', start_time: '11:00', end_time: '12:00' },
      { id: 'b', day: 'd', start_time: '11:30', end_time: '12:30' },
      { id: 'c', day: 'd', start_time: '12:00', end_time: '13:00' },
    ])
    expect(m.get('c')!.row).toBe(0)
  })
})

describe('minutesToLabel', () => {
  it('formats daytime and after-midnight minutes', () => {
    expect(minutesToLabel(840)).toBe('14:00')
    expect(minutesToLabel(1440)).toBe('00:00')
    expect(minutesToLabel(1470)).toBe('00:30')
    expect(minutesToLabel(1500)).toBe('01:00')
  })
})
