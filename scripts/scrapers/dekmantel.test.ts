import { describe, it, expect } from 'vitest'
import { parseIsoTime, extractLiveStatus, getStageName, resolveDayDate, levenshtein, matchCanonical, type CanonicalName, type NuxtTimeslot } from './dekmantel.js'

describe('levenshtein', () => {
  it('counts single-character substitutions', () => {
    expect(levenshtein('meska', 'neska')).toBe(1)
    expect(levenshtein('komduku', 'konduku')).toBe(1)
  })
  it('is zero for identical strings and full for disjoint', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
    expect(levenshtein('abc', 'xyz')).toBe(3)
  })
})

describe('matchCanonical', () => {
  const canon = new Map<string, CanonicalName>([
    ['neska', { name: 'Neska', isLive: false }],
    ['konduku', { name: 'Konduku', isLive: false }],
    ['dvs1', { name: 'DVS1', isLive: false }],
    ['dax j', { name: 'Dax J', isLive: false }],
  ])
  it('returns the exact match (canonical casing)', () => {
    expect(matchCanonical('NESKA', canon)?.name).toBe('Neska')
  })
  it('corrects a one-char OCR slip to the Nuxt spelling', () => {
    expect(matchCanonical('MESKA', canon)?.name).toBe('Neska')
    expect(matchCanonical('KOMDUKU', canon)?.name).toBe('Konduku')
  })
  it('keeps the poster name when nothing is close enough', () => {
    expect(matchCanonical('Some Unknown Act', canon)).toBeUndefined()
  })
  it('does not over-correct a genuinely different short name', () => {
    // "Max J" is 1 edit from "Dax J" but also plausibly a distinct act — allowed only
    // because it is the single nearest within budget; a real ambiguity (tie) is skipped
    const ambiguous = new Map<string, CanonicalName>([
      ['dax j', { name: 'Dax J', isLive: false }],
      ['max k', { name: 'Max K', isLive: false }],
    ])
    expect(matchCanonical('max j', ambiguous)).toBeUndefined() // ties at distance 1 → skip
  })
})

describe('resolveDayDate', () => {
  it('maps a day-of-month to a date within the festival range', () => {
    expect(resolveDayDate(30, '2026-07-29', '2026-08-02')).toBe('2026-07-30')
  })
  it('handles cross-month ranges (tab "01" = August 1st)', () => {
    expect(resolveDayDate(1, '2026-07-29', '2026-08-02')).toBe('2026-08-01')
    expect(resolveDayDate(2, '2026-07-29', '2026-08-02')).toBe('2026-08-02')
  })
  it('returns null for a day outside the range', () => {
    expect(resolveDayDate(15, '2026-07-29', '2026-08-02')).toBeNull()
  })
})

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
