import { describe, it, expect } from 'vitest'
import { isAfterMidnight, toSortableTime, getDays, formatDayLabel } from './dates.js'

describe('isAfterMidnight', () => {
  it('returns true for times before 07:00', () => {
    expect(isAfterMidnight('00:00')).toBe(true)
    expect(isAfterMidnight('03:00')).toBe(true)
    expect(isAfterMidnight('06:59')).toBe(true)
  })

  it('returns false for 07:00 and later', () => {
    expect(isAfterMidnight('07:00')).toBe(false)
    expect(isAfterMidnight('14:00')).toBe(false)
    expect(isAfterMidnight('23:59')).toBe(false)
  })
})

describe('toSortableTime', () => {
  it('adds 24h to after-midnight times', () => {
    expect(toSortableTime('00:30')).toBe('24:30')
    expect(toSortableTime('02:00')).toBe('26:00')
    expect(toSortableTime('06:59')).toBe('30:59')
  })

  it('leaves daytime times unchanged', () => {
    expect(toSortableTime('07:00')).toBe('07:00')
    expect(toSortableTime('14:00')).toBe('14:00')
    expect(toSortableTime('23:59')).toBe('23:59')
  })

  it('sorts after-midnight after 23:59', () => {
    const times = ['02:00', '23:00', '14:00', '00:30']
    const sorted = [...times].sort((a, b) =>
      toSortableTime(a).localeCompare(toSortableTime(b))
    )
    expect(sorted).toEqual(['14:00', '23:00', '00:30', '02:00'])
  })
})

describe('getDays', () => {
  it('returns all dates between start and end inclusive', () => {
    expect(getDays('2026-07-10', '2026-07-12')).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ])
  })

  it('returns single date when start equals end', () => {
    expect(getDays('2026-07-10', '2026-07-10')).toEqual(['2026-07-10'])
  })

  it('handles month boundaries', () => {
    expect(getDays('2026-07-30', '2026-08-02')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
  })
})

describe('formatDayLabel', () => {
  it('formats date as short uppercase label', () => {
    const label = formatDayLabel('2026-07-10')
    expect(label).toMatch(/FRI/i)
    expect(label).toMatch(/10/)
    expect(label).toMatch(/JUL/i)
  })

  it('formats a Saturday', () => {
    const label = formatDayLabel('2026-07-11')
    expect(label).toMatch(/SAT/i)
    expect(label).toMatch(/11/)
  })
})
