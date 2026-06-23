import { describe, it, expect } from 'vitest'
import { generateSql } from './ingest-diff.js'
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

describe('generateSql', () => {
  it('writes bio_festival alongside bio on insert and preserves it via ON CONFLICT', () => {
    const scraped = makeScrapedData({
      sets: [
        { artist_name: 'Ben Klock', stage: null, day: '2026-07-01', start_time: null, end_time: null, is_live: false },
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
        { artist_name: 'Unknown DJ', stage: null, day: '2026-07-01', start_time: null, end_time: null, is_live: false },
      ],
      artists: [],
    })

    const sql = generateSql(scraped, emptySetDiff)

    expect(sql).toContain("VALUES ('Unknown DJ', 'unknown dj', false)")
  })
})
