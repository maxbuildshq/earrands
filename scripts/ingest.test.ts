import { describe, it, expect } from 'vitest'
import { normalizeTime, normalizeText, setKey, computeDiff, computeFlags, escSql } from './lib/ingest-diff.js'
import type { DbState } from './lib/ingest-diff.js'
import type { ScrapedData } from './scrapers/types.js'

// ── Helper factories ────────────────────────────────────────────────────────

function makeScrapedData(overrides: Partial<ScrapedData> = {}): ScrapedData {
  return {
    festival: {
      name: 'Test Festival 2026',
      slug: 'test-festival-2026',
      location: 'Amsterdam',
      start_date: '2026-08-01',
      end_date: '2026-08-02',
      timetable_announced: true,
      website_url: 'https://example.com',
    },
    stages: [],
    sets: [],
    artists: [],
    ...overrides,
  }
}

function makeDbState(overrides: Partial<DbState> = {}): DbState {
  return {
    festival: {
      id: 'fest-uuid',
      name: 'Test Festival 2026',
      slug: 'test-festival-2026',
      location: 'Amsterdam',
      start_date: '2026-08-01',
      end_date: '2026-08-02',
      timetable_announced: true,
    },
    stages: [],
    sets: [],
    artists: [],
    ...overrides,
  }
}

// ── Unit tests ──────────────────────────────────────────────────────────────

describe('normalizeTime', () => {
  it('strips seconds from HH:MM:SS', () => {
    expect(normalizeTime('14:00:00')).toBe('14:00')
  })

  it('leaves HH:MM unchanged', () => {
    expect(normalizeTime('14:00')).toBe('14:00')
  })

  it('returns null for null', () => {
    expect(normalizeTime(null)).toBeNull()
  })
})

describe('normalizeText', () => {
  it('normalizes curly single quotes to straight', () => {
    const input = String.fromCodePoint(0x2018) + 'hello' + String.fromCodePoint(0x2019)
    const sq = String.fromCharCode(39) // straight single quote
    expect(normalizeText(input)).toBe(sq + 'hello' + sq)
  })

  it('normalizes curly double quotes to straight', () => {
    const input = String.fromCodePoint(0x201C) + 'hello' + String.fromCodePoint(0x201D)
    const dq = String.fromCharCode(34) // straight double quote
    expect(normalizeText(input)).toBe(dq + 'hello' + dq)
  })

  it('normalizes prime marks', () => {
    const input = String.fromCodePoint(0x2032)
    const sq = String.fromCharCode(39)
    expect(normalizeText(input)).toBe(sq)
  })
})

describe('setKey', () => {
  it('builds key from artist, day, and stage', () => {
    expect(setKey('Ben UFO', '2026-08-01', 'By Day')).toBe('Ben UFO|2026-08-01|By Day')
  })

  it('handles null stage', () => {
    expect(setKey('Ben UFO', '2026-08-01', null)).toBe('Ben UFO|2026-08-01|')
  })
})

describe('escSql', () => {
  it('escapes single quotes', () => {
    expect(escSql("O'Sullivan")).toBe("O''Sullivan")
  })

  it('leaves clean strings unchanged', () => {
    expect(escSql('Ben UFO')).toBe('Ben UFO')
  })
})

// ── computeDiff ─────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  it('detects fresh festival (all sets added)', () => {
    const scraped = makeScrapedData({
      sets: [
        { artist_name: 'Ben UFO', stage: 'Main', day: '2026-08-01', start_time: '14:00', end_time: '16:00', is_live: false },
      ],
    })
    const db = makeDbState({ festival: null, stages: [], sets: [] })

    const { setDiff, entries } = computeDiff(scraped, db)
    expect(setDiff.added).toHaveLength(1)
    expect(setDiff.removed).toHaveLength(0)
    expect(setDiff.rescheduled).toHaveLength(0)
    expect(entries.some(e => e.type === 'added' && e.category === 'festival')).toBe(true)
  })

  it('detects no changes when DB matches scraped', () => {
    const scraped = makeScrapedData({
      stages: [{ name: 'Main', sort_order: 1 }],
      sets: [
        { artist_name: 'Ben UFO', stage: 'Main', day: '2026-08-01', start_time: '14:00', end_time: '16:00', is_live: false },
      ],
    })
    const db = makeDbState({
      stages: [{ id: 'stage-1', festival_id: 'fest-uuid', name: 'Main', sort_order: 1 }],
      sets: [
        { id: 'set-1', festival_id: 'fest-uuid', stage_id: 'stage-1', artist_name: 'Ben UFO', day: '2026-08-01', start_time: '14:00', end_time: '16:00', is_live: false },
      ],
    })

    const { setDiff } = computeDiff(scraped, db)
    expect(setDiff.unchanged).toHaveLength(1)
    expect(setDiff.added).toHaveLength(0)
    expect(setDiff.removed).toHaveLength(0)
    expect(setDiff.updated).toHaveLength(0)
    expect(setDiff.rescheduled).toHaveLength(0)
  })

  it('detects time change as update (not reschedule)', () => {
    const scraped = makeScrapedData({
      stages: [{ name: 'Main', sort_order: 1 }],
      sets: [
        { artist_name: 'Ben UFO', stage: 'Main', day: '2026-08-01', start_time: '15:00', end_time: '17:00', is_live: false },
      ],
    })
    const db = makeDbState({
      stages: [{ id: 'stage-1', festival_id: 'fest-uuid', name: 'Main', sort_order: 1 }],
      sets: [
        { id: 'set-1', festival_id: 'fest-uuid', stage_id: 'stage-1', artist_name: 'Ben UFO', day: '2026-08-01', start_time: '14:00', end_time: '16:00', is_live: false },
      ],
    })

    const { setDiff } = computeDiff(scraped, db)
    expect(setDiff.updated).toHaveLength(1)
    expect(setDiff.updated[0].changes).toEqual(
      expect.arrayContaining([expect.stringContaining('start')])
    )
    expect(setDiff.rescheduled).toHaveLength(0)
  })

  it('detects is_live change as update', () => {
    const scraped = makeScrapedData({
      stages: [{ name: 'Main', sort_order: 1 }],
      sets: [
        { artist_name: 'Alex Wilcox', stage: 'Main', day: '2026-08-02', start_time: '20:00', end_time: '21:00', is_live: true },
      ],
    })
    const db = makeDbState({
      stages: [{ id: 'stage-1', festival_id: 'fest-uuid', name: 'Main', sort_order: 1 }],
      sets: [
        { id: 'set-1', festival_id: 'fest-uuid', stage_id: 'stage-1', artist_name: 'Alex Wilcox', day: '2026-08-02', start_time: '20:00', end_time: '21:00', is_live: false },
      ],
    })

    const { setDiff } = computeDiff(scraped, db)
    expect(setDiff.updated).toHaveLength(1)
    expect(setDiff.updated[0].changes).toEqual(
      expect.arrayContaining([expect.stringContaining('live')])
    )
  })

  it('detects new set (not in DB)', () => {
    const scraped = makeScrapedData({
      sets: [
        { artist_name: 'New Artist', stage: 'Main', day: '2026-08-01', start_time: '11:00', end_time: '13:00', is_live: false },
      ],
    })
    const db = makeDbState()

    const { setDiff } = computeDiff(scraped, db)
    expect(setDiff.added).toHaveLength(1)
    expect(setDiff.added[0].artist_name).toBe('New Artist')
  })

  it('detects removed set (in DB but not scraped)', () => {
    const scraped = makeScrapedData()
    const db = makeDbState({
      stages: [{ id: 'stage-1', festival_id: 'fest-uuid', name: 'Main', sort_order: 1 }],
      sets: [
        { id: 'set-1', festival_id: 'fest-uuid', stage_id: 'stage-1', artist_name: 'Cancelled Artist', day: '2026-07-31', start_time: '18:00', end_time: '20:00', is_live: false },
      ],
    })

    const { setDiff } = computeDiff(scraped, db)
    expect(setDiff.removed).toHaveLength(1)
    expect(setDiff.removed[0].artist_name).toBe('Cancelled Artist')
  })

  it('detects reschedule when day changes', () => {
    const scraped = makeScrapedData({
      stages: [{ name: 'Main', sort_order: 1 }],
      sets: [
        { artist_name: 'Speedy J', stage: 'Main', day: '2026-08-02', start_time: '20:00', end_time: '22:00', is_live: false },
      ],
    })
    const db = makeDbState({
      stages: [{ id: 'stage-1', festival_id: 'fest-uuid', name: 'Main', sort_order: 1 }],
      sets: [
        { id: 'set-1', festival_id: 'fest-uuid', stage_id: 'stage-1', artist_name: 'Speedy J', day: '2026-08-01', start_time: '21:00', end_time: '23:00', is_live: false },
      ],
    })

    const { setDiff, entries } = computeDiff(scraped, db)
    expect(setDiff.rescheduled).toHaveLength(1)
    expect(setDiff.rescheduled[0].scraped.day).toBe('2026-08-02')
    expect(setDiff.rescheduled[0].existing.day).toBe('2026-08-01')
    expect(setDiff.added).toHaveLength(0)
    expect(setDiff.removed).toHaveLength(0)
    expect(entries.some(e => e.type === 'rescheduled')).toBe(true)
  })

  it('detects reschedule when stage changes', () => {
    const scraped = makeScrapedData({
      stages: [
        { name: 'Melkweg', sort_order: 1 },
        { name: 'Paradiso', sort_order: 2 },
      ],
      sets: [
        { artist_name: 'Josey Rebelle', stage: 'Paradiso', day: '2026-07-30', start_time: null, end_time: null, is_live: false },
      ],
    })
    const db = makeDbState({
      stages: [
        { id: 'stage-1', festival_id: 'fest-uuid', name: 'Melkweg', sort_order: 1 },
        { id: 'stage-2', festival_id: 'fest-uuid', name: 'Paradiso', sort_order: 2 },
      ],
      sets: [
        { id: 'set-1', festival_id: 'fest-uuid', stage_id: 'stage-1', artist_name: 'Josey Rebelle', day: '2026-07-30', start_time: null, end_time: null, is_live: false },
      ],
    })

    const { setDiff } = computeDiff(scraped, db)
    expect(setDiff.rescheduled).toHaveLength(1)
    expect(setDiff.rescheduled[0].existing.stage_name).toBe('Melkweg')
    expect(setDiff.rescheduled[0].scraped.stage).toBe('Paradiso')
  })

  it('handles NULL stage exact match', () => {
    const scraped = makeScrapedData({
      sets: [
        { artist_name: 'Space Afrika', stage: null, day: '2026-07-29', start_time: null, end_time: null, is_live: false },
      ],
    })
    const db = makeDbState({
      sets: [
        { id: 'set-1', festival_id: 'fest-uuid', stage_id: null, artist_name: 'Space Afrika', day: '2026-07-29', start_time: null, end_time: null, is_live: false },
      ],
    })

    const { setDiff } = computeDiff(scraped, db)
    expect(setDiff.unchanged).toHaveLength(1)
    expect(setDiff.added).toHaveLength(0)
    expect(setDiff.removed).toHaveLength(0)
  })
})

// ── computeFlags ────────────────────────────────────────────────────────────

describe('computeFlags', () => {
  it('flags rescheduled sets', () => {
    const scraped = makeScrapedData()
    const setDiff = {
      added: [], removed: [], updated: [], unchanged: [],
      rescheduled: [{
        scraped: { artist_name: 'Speedy J', stage: 'Main', day: '2026-08-02', start_time: '20:00', end_time: '22:00', is_live: false },
        existing: { artist_name: 'Speedy J', stage_name: 'Main', day: '2026-08-01', start_time: '21:00', end_time: '23:00', is_live: false },
      }],
    }

    const flags = computeFlags(scraped, setDiff)
    expect(flags.some(f => f.level === 'reschedule' && f.message.includes('Speedy J'))).toBe(true)
  })

  it('flags removed sets with cascade warning', () => {
    const scraped = makeScrapedData()
    const setDiff = {
      added: [], updated: [], unchanged: [], rescheduled: [],
      removed: [{
        artist_name: 'Gone Artist', stage_name: 'Main', day: '2026-08-01', start_time: '18:00', end_time: '20:00', is_live: false,
      }],
    }

    const flags = computeFlags(scraped, setDiff)
    expect(flags.some(f => f.level === 'removal' && f.message.includes('user_plans'))).toBe(true)
  })

  it('flags sets with no start_time in timetable-announced festival', () => {
    const scraped = makeScrapedData({
      sets: [
        { artist_name: 'No Time', stage: 'Main', day: '2026-08-01', start_time: null, end_time: null, is_live: false },
      ],
    })
    const setDiff = { added: [], removed: [], updated: [], unchanged: [], rescheduled: [] }

    const flags = computeFlags(scraped, setDiff)
    expect(flags.some(f => f.level === 'warn' && f.message.includes('no start_time'))).toBe(true)
  })
})
