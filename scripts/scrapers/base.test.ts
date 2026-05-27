import { describe, it, expect } from 'vitest'
import { parseTimeRange, generateSlug } from './base.js'

describe('parseTimeRange', () => {
  it('parses standard time range', () => {
    expect(parseTimeRange('14:00 - 16:00')).toEqual({
      start_time: '14:00',
      end_time: '16:00',
    })
  })

  it('parses without spaces around dash', () => {
    expect(parseTimeRange('14:00-16:00')).toEqual({
      start_time: '14:00',
      end_time: '16:00',
    })
  })

  it('pads single-digit hours', () => {
    expect(parseTimeRange('9:00 - 11:00')).toEqual({
      start_time: '09:00',
      end_time: '11:00',
    })
  })

  it('handles after-midnight times', () => {
    expect(parseTimeRange('23:00 - 01:00')).toEqual({
      start_time: '23:00',
      end_time: '01:00',
    })
  })

  it('handles time embedded in other text', () => {
    expect(parseTimeRange('  14:00 - 16:00  ')).toEqual({
      start_time: '14:00',
      end_time: '16:00',
    })
  })

  it('returns null for no match', () => {
    expect(parseTimeRange('TBA')).toBeNull()
    expect(parseTimeRange('')).toBeNull()
    expect(parseTimeRange('no time here')).toBeNull()
  })
})

describe('generateSlug', () => {
  it('converts to lowercase with hyphens', () => {
    expect(generateSlug('Awakenings Festival 2026')).toBe('awakenings-festival-2026')
  })

  it('removes special characters', () => {
    expect(generateSlug('909 Festival 2026')).toBe('909-festival-2026')
  })

  it('collapses multiple spaces and hyphens', () => {
    expect(generateSlug('Some  Festival -- 2026')).toBe('some-festival-2026')
  })

  it('strips leading and trailing hyphens', () => {
    expect(generateSlug(' -Festival- ')).toBe('festival')
  })

  it('handles Dekmantel', () => {
    expect(generateSlug('Dekmantel 2026')).toBe('dekmantel-2026')
  })
})
