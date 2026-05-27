import { describe, it, expect } from 'vitest'
import { parseFestivalDates, parseAwakeningsDate, resolveDayDate } from './awakenings.js'

describe('parseAwakeningsDate', () => {
  it('parses date with day name prefix', () => {
    expect(parseAwakeningsDate('Saturday May 16 2026')).toBe('2026-05-16')
  })

  it('parses date without day name prefix', () => {
    expect(parseAwakeningsDate('May 16 2026')).toBe('2026-05-16')
  })

  it('pads single-digit days', () => {
    expect(parseAwakeningsDate('June 6 2026')).toBe('2026-06-06')
  })

  it('handles all months', () => {
    expect(parseAwakeningsDate('January 1 2026')).toBe('2026-01-01')
    expect(parseAwakeningsDate('December 31 2026')).toBe('2026-12-31')
  })

  it('throws on unparseable input', () => {
    expect(() => parseAwakeningsDate('garbage')).toThrow()
  })
})

describe('parseFestivalDates', () => {
  it('parses a two-day date range', () => {
    expect(parseFestivalDates('Saturday May 16 2026 - Sunday May 17 2026')).toEqual({
      start_date: '2026-05-16',
      end_date: '2026-05-17',
    })
  })

  it('strips "Sold out" suffix', () => {
    expect(parseFestivalDates('Saturday May 16 2026 - Sunday May 17 2026 Sold out')).toEqual({
      start_date: '2026-05-16',
      end_date: '2026-05-17',
    })
  })

  it('strips "Tickets" suffix', () => {
    expect(parseFestivalDates('Friday July 10 2026 - Sunday July 12 2026 Tickets')).toEqual({
      start_date: '2026-07-10',
      end_date: '2026-07-12',
    })
  })
})

describe('resolveDayDate', () => {
  it('resolves Saturday within a 3-day range', () => {
    expect(resolveDayDate('SATURDAY', '2026-07-10', '2026-07-12')).toBe('2026-07-11')
  })

  it('resolves Friday within a 3-day range', () => {
    expect(resolveDayDate('FRIDAY', '2026-07-10', '2026-07-12')).toBe('2026-07-10')
  })

  it('resolves Sunday within a 3-day range', () => {
    expect(resolveDayDate('SUNDAY', '2026-07-10', '2026-07-12')).toBe('2026-07-12')
  })

  it('is case-insensitive', () => {
    expect(resolveDayDate('saturday', '2026-07-10', '2026-07-12')).toBe('2026-07-11')
  })

  it('throws when day is not in range', () => {
    expect(() => resolveDayDate('MONDAY', '2026-07-10', '2026-07-12')).toThrow()
  })
})
