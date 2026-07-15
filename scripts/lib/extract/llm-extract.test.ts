import { describe, it, expect } from 'vitest'
import { validateScrapedData, extractJsonBlock, buildExtractionPrompt } from './llm-extract.js'
import type { PageDump } from './page-dump.js'

const valid = {
  festival: {
    name: 'Test Fest',
    slug: 'test-fest-2026',
    location: 'Amsterdam, Netherlands',
    start_date: '2026-08-01',
    end_date: '2026-08-02',
    timetable_announced: true,
    website_url: 'https://testfest.example',
  },
  stages: [{ name: 'Main', sort_order: 0 }],
  sets: [
    { artist_name: 'Speedy J', stage: 'Main', day: '2026-08-01', start_time: '22:00', end_time: '23:30', is_live: false },
    { artist_name: 'KI/KI', stage: 'Main', day: '2026-08-01', start_time: '23:30', end_time: '01:00', is_live: true },
  ],
  artists: [],
}

describe('validateScrapedData', () => {
  it('accepts a valid payload', () => {
    const r = validateScrapedData(valid)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings).toEqual([])
  })

  it('rejects non-objects and missing festival', () => {
    expect(validateScrapedData(null).ok).toBe(false)
    expect(validateScrapedData({ stages: [], sets: [], artists: [] }).ok).toBe(false)
  })

  it('rejects bad slug, dates, and times', () => {
    const bad = structuredClone(valid)
    bad.festival.slug = 'Bad Slug!'
    bad.festival.start_date = '01-08-2026'
    bad.sets[0].start_time = '10pm'
    const r = validateScrapedData(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.some(e => e.includes('slug'))).toBe(true)
      expect(r.errors.some(e => e.includes('start_date'))).toBe(true)
      expect(r.errors.some(e => e.includes('start_time'))).toBe(true)
    }
  })

  it('rejects duplicate sets and unknown stages', () => {
    const bad = structuredClone(valid)
    bad.sets.push({ ...bad.sets[0] })
    bad.sets[1].stage = 'Ghost Stage'
    const r = validateScrapedData(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.some(e => e.includes('duplicate set'))).toBe(true)
      expect(r.errors.some(e => e.includes('Ghost Stage'))).toBe(true)
    }
  })

  it('allows lineup-only sets (null stage/times) and warns on partial times', () => {
    const lineup = structuredClone(valid)
    lineup.sets = [
      { artist_name: 'Speedy J', stage: null as any, day: '2026-08-01', start_time: null as any, end_time: null as any, is_live: false },
      { artist_name: 'KI/KI', stage: 'Main', day: '2026-08-01', start_time: '23:30', end_time: '01:00', is_live: true },
    ]
    const r = validateScrapedData(lineup)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings.some(w => w.includes('no start_time'))).toBe(true)
  })
})

describe('extractJsonBlock', () => {
  it('strips markdown fences', () => {
    expect(extractJsonBlock('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('strips chatter around the JSON object', () => {
    expect(extractJsonBlock('Here is the data:\n{"a":1}\nHope that helps!')).toBe('{"a":1}')
  })

  it('passes clean JSON through', () => {
    expect(extractJsonBlock('{"a":{"b":2}}')).toBe('{"a":{"b":2}}')
  })
})

describe('buildExtractionPrompt', () => {
  const dump: PageDump = {
    url: 'https://testfest.example/timetable',
    title: 'Test Fest — Timetable',
    text: 'SPEEDY J 22:00-23:30 MAIN',
    payloads: { ldJson: [{ '@type': 'MusicEvent' }] },
    xhr: [{ url: 'https://testfest.example/api/lineup', body: { acts: [] } }],
    images: [{ src: 'https://testfest.example/speedy-j.jpg', alt: 'Speedy J' }],
  }

  it('points at the dump file, output file, and includes url + stats', () => {
    const p = buildExtractionPrompt(dump, 'scraped/dump-testfest.example.json', 'scraped/dump-testfest.example.extracted.json')
    expect(p).toContain('scraped/dump-testfest.example.json')
    expect(p).toContain('WRITE it as a single JSON object to: scraped/dump-testfest.example.extracted.json')
    expect(p).toContain('https://testfest.example/timetable')
    expect(p).toContain('payloads [ldJson]')
    expect(p).toContain('1 XHR responses')
    expect(p).toContain('1 images')
  })
})
