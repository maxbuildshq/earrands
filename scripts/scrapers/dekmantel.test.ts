import { describe, it, expect } from 'vitest'
import { parseIsoTime, extractLiveStatus, getStageName, type NuxtTimeslot } from './dekmantel.js'

describe('parseIsoTime', () => {
  it('parses ISO timestamp to day and time', () => {
    expect(parseIsoTime('2026-08-02T17:30:00.7200Z')).toEqual({
      day: '2026-08-02',
      time: '17:30',
    })
  })

  it('handles midnight', () => {
    expect(parseIsoTime('2026-08-01T00:00:00.0000Z')).toEqual({
      day: '2026-08-01',
      time: '00:00',
    })
  })

  it('throws on invalid format', () => {
    expect(() => parseIsoTime('not-a-date')).toThrow()
  })
})

describe('extractLiveStatus', () => {
  it('returns false for regular artist', () => {
    expect(extractLiveStatus('Ben UFO')).toEqual({
      artistName: 'Ben UFO',
      isLive: false,
    })
  })

  it('detects trailing Live', () => {
    expect(extractLiveStatus('Moderat Live')).toEqual({
      artistName: 'Moderat',
      isLive: true,
    })
  })

  it('detects (live) suffix', () => {
    expect(extractLiveStatus('Moderat (live)')).toEqual({
      artistName: 'Moderat',
      isLive: true,
    })
  })

  it('detects Live before parenthetical qualifier', () => {
    expect(extractLiveStatus('Band Live (Member A & Member B)')).toEqual({
      artistName: 'Band (Member A & Member B)',
      isLive: true,
    })
  })

  it('detects Live before w/ qualifier', () => {
    expect(extractLiveStatus('Band Live w/ Vocalist')).toEqual({
      artistName: 'Band w/ Vocalist',
      isLive: true,
    })
  })
})

function makeTimeslot(overrides: Partial<NuxtTimeslot> = {}): NuxtTimeslot {
  return {
    slug: 'test',
    name: 'Test',
    content: null,
    location: null,
    venue: null,
    atDawnByNight: null,
    timeStart: null,
    timeEnd: null,
    showTime: false,
    artist: null,
    ...overrides,
  }
}

describe('getStageName', () => {
  it('returns null when no location', () => {
    expect(getStageName(makeTimeslot())).toBeNull()
  })

  it('returns venue name for ITC location', () => {
    expect(getStageName(makeTimeslot({
      location: { slug: 'into-the-city', name: 'Into The City' },
      venue: { slug: 'melkweg', name: 'Melkweg' },
    }))).toBe('Melkweg')
  })

  it('falls back to "Into The City" when ITC has no venue', () => {
    expect(getStageName(makeTimeslot({
      location: { slug: 'into-the-city', name: 'Into The City' },
    }))).toBe('Into The City')
  })

  it('returns "Amsterdamse Bos — By Day" for Bos with no sub-event', () => {
    expect(getStageName(makeTimeslot({
      location: { slug: 'amsterdamse-bos', name: 'Amsterdamse Bos' },
    }))).toBe('Amsterdamse Bos — By Day')
  })

  it('returns "Amsterdamse Bos — At Dawn" for dawn sub-event', () => {
    expect(getStageName(makeTimeslot({
      location: { slug: 'amsterdamse-bos', name: 'Amsterdamse Bos' },
      atDawnByNight: { slug: 'at-dawn', name: 'At Dawn' },
    }))).toBe('Amsterdamse Bos — At Dawn')
  })
})
