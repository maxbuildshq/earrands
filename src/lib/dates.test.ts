import { describe, it, expect } from 'vitest'
import { isAfterMidnight, toSortableTime, getDays, formatDayLabel, getCurrentFestivalDay } from './dates.js'

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

describe('getCurrentFestivalDay', () => {
  const days = ['2026-06-06', '2026-06-07']

  // Helper: create a Date at a specific Amsterdam time
  // Amsterdam is UTC+2 in summer (CEST)
  function amsDate(dateStr: string, time: string): Date {
    return new Date(`${dateStr}T${time}+02:00`)
  }

  it('returns day 1 during afternoon of day 1', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-06', '15:00'))).toBe('2026-06-06')
  })

  it('returns day 2 during afternoon of day 2', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-07', '14:00'))).toBe('2026-06-07')
  })

  it('returns day 1 at 3am next calendar day (before 07:00 cutoff)', () => {
    // 3am on June 7 in Amsterdam = still festival day June 6
    expect(getCurrentFestivalDay(days, amsDate('2026-06-07', '03:00'))).toBe('2026-06-06')
  })

  it('returns day 2 at 3am on June 8 (before 07:00 cutoff)', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-08', '03:00'))).toBe('2026-06-07')
  })

  it('returns day 2 at 06:59 (just before cutoff)', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-08', '06:59'))).toBe('2026-06-07')
  })

  it('returns undefined at 07:00 on June 8 (cutoff, day after festival)', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-08', '07:00'))).toBeUndefined()
  })

  it('returns day 2 at 08:00 on June 7', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-07', '08:00'))).toBe('2026-06-07')
  })

  it('returns undefined before festival starts', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-05', '14:00'))).toBeUndefined()
  })

  it('returns undefined well after festival ends', () => {
    expect(getCurrentFestivalDay(days, amsDate('2026-06-10', '14:00'))).toBeUndefined()
  })
})
