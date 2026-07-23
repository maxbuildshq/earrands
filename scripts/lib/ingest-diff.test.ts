import { describe, it, expect } from 'vitest'
import { computeFlags, generateSql } from './ingest-diff.js'
import type { ScrapedData } from '../scrapers/types.js'
import type { SetDiff } from './ingest-diff.js'

const emptySetDiff: SetDiff = {
  added: [],
  removed: [],
  updated: [],
  rescheduled: [],
  unchanged: [],
}

function makeScrapedData(overrides: Partial<ScrapedData> = {}): ScrapedData {
  return {
    festival: {
      name: 'Test Festival',
      slug: 'test-festival',
      location: 'Berlin',
      start_date: '2026-07-01',
      end_date: '2026-07-02',
      timetable_announced: true,
      website_url: 'https://example.com',
    },
    stages: [],
    sets: [],
    artists: [],
    ...overrides,
  }
}

describe('computeFlags — extraction warnings', () => {
  it('surfaces scraper extraction_warnings as warn flags in the diff preview', () => {
    const scraped = makeScrapedData({
      extraction_warnings: ['2026-08-02 RADAR: times from vision fallback (pixel gridlines not fully detected) — verify against the poster'],
    })
    const flags = computeFlags(scraped, emptySetDiff)
    expect(flags).toContainEqual({
      level: 'warn',
      message: '2026-08-02 RADAR: times from vision fallback (pixel gridlines not fully detected) — verify against the poster',
    })
  })

  it('adds no flags when extraction_warnings is absent', () => {
    expect(computeFlags(makeScrapedData(), emptySetDiff)).toEqual([])
  })
})

describe('generateSql', () => {
  it('writes bio_festival alongside bio on insert and preserves it via ON CONFLICT', () => {
    const scraped = makeScrapedData({
      sets: [
        { artist_name: 'Ben Klock', stage: null, day: '2026-07-01', start_time: null, end_time: null, performance_type: null },
      ],
      artists: [
        { name: 'Ben Klock', bio: 'A techno DJ from Berlin.', source_url: 'https://example.com/ben-klock' },
      ],
    })

    const sql = generateSql(scraped, emptySetDiff)

    expect(sql).toContain("bio_festival")
    expect(sql).toContain("VALUES ('Ben Klock', 'ben klock', false, 'A techno DJ from Berlin.', 'https://example.com/ben-klock', 'festival:test-festival', 'A techno DJ from Berlin.')")
    expect(sql).toContain(
      "bio_festival = CASE WHEN EXCLUDED.bio_festival IS NOT NULL AND (artists.bio IS NULL OR length(EXCLUDED.bio) > length(artists.bio)) THEN EXCLUDED.bio_festival ELSE artists.bio_festival END,"
    )
  })

  it('omits bio_festival when no bio was scraped', () => {
    const scraped = makeScrapedData({
      sets: [
        { artist_name: 'Unknown DJ', stage: null, day: '2026-07-01', start_time: null, end_time: null, performance_type: null },
      ],
      artists: [],
    })

    const sql = generateSql(scraped, emptySetDiff)

    expect(sql).toContain("VALUES ('Unknown DJ', 'unknown dj', false)")
  })

  it('writes performance_type on set insert (live / hybrid / normal → NULL) and never is_live', () => {
    const liveSet = { artist_name: 'Luigi Tozzi', stage: null, day: '2026-07-01', start_time: null, end_time: null, performance_type: 'live' as const }
    const hybridSet = { artist_name: 'Fjaak', stage: null, day: '2026-07-01', start_time: null, end_time: null, performance_type: 'hybrid' as const }
    const normalSet = { artist_name: 'Call Super', stage: null, day: '2026-07-01', start_time: null, end_time: null, performance_type: null }
    const scraped = makeScrapedData({ sets: [liveSet, hybridSet, normalSet] })

    const sql = generateSql(scraped, { ...emptySetDiff, added: [liveSet, hybridSet, normalSet] })

    expect(sql).toContain('INSERT INTO sets (festival_id, stage_id, artist_name, day, start_time, end_time, performance_type)')
    expect(sql).not.toContain('is_live')
    expect(sql).toContain("'Luigi Tozzi', '2026-07-01', NULL, NULL, 'live')")
    expect(sql).toContain("'Fjaak', '2026-07-01', NULL, NULL, 'hybrid')")
    expect(sql).toContain("'Call Super', '2026-07-01', NULL, NULL, NULL)")
  })
})
