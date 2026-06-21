import { describe, it, expect } from 'vitest'

// Test the field whitelisting logic used by Edge Functions.
// This mirrors the server-side logic to ensure the allowed-fields lists
// don't accidentally let through sensitive fields.

const FESTIVAL_ALLOWED_UPDATE = ['name', 'slug', 'location', 'start_date', 'end_date', 'timetable_announced', 'published']
const FESTIVAL_ALLOWED_TOGGLE = ['published', 'timetable_announced']
const ARTIST_ALLOWED_UPDATE = [
  'name', 'sort_name', 'bio', 'bio_festival', 'bio_generated', 'bio_source',
  'image_url', 'instagram_url', 'soundcloud_url', 'soundcloud_embed_url',
  'bandcamp_url', 'discogs_id', 'city', 'country_code',
  'enrichment_status', 'enriched_at',
]
const ARTIST_ALLOWED_BULK = ['enrichment_status', 'enriched_at']

function filterFields(updates: Record<string, unknown>, allowed: string[]) {
  const filtered: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key]
  }
  return filtered
}

describe('Admin field whitelisting', () => {
  describe('festival updates', () => {
    it('allows whitelisted fields through', () => {
      const input = { id: '123', name: 'Test', slug: 'test', location: 'NL' }
      const { id, ...updates } = input
      const result = filterFields(updates, FESTIVAL_ALLOWED_UPDATE)
      expect(result).toEqual({ name: 'Test', slug: 'test', location: 'NL' })
    })

    it('strips unknown fields', () => {
      const updates = { name: 'Test', created_at: 'hacked', id: 'injected' }
      const result = filterFields(updates, FESTIVAL_ALLOWED_UPDATE)
      expect(result).toEqual({ name: 'Test' })
      expect(result).not.toHaveProperty('created_at')
      expect(result).not.toHaveProperty('id')
    })
  })

  describe('festival toggles', () => {
    it('only allows published and timetable_announced', () => {
      const updates = { published: true, name: 'hacked', timetable_announced: false }
      const result = filterFields(updates, FESTIVAL_ALLOWED_TOGGLE)
      expect(result).toEqual({ published: true, timetable_announced: false })
      expect(result).not.toHaveProperty('name')
    })
  })

  describe('artist updates', () => {
    it('allows enrichment fields', () => {
      const updates = {
        soundcloud_url: 'https://soundcloud.com/test',
        instagram_url: 'https://instagram.com/test',
        city: 'Amsterdam',
        enrichment_status: 'reviewed',
      }
      const result = filterFields(updates, ARTIST_ALLOWED_UPDATE)
      expect(result).toEqual(updates)
    })

    it('strips dangerous fields', () => {
      const updates = {
        name: 'OK',
        id: 'injected',
        created_at: 'hacked',
        source_url: 'should-not-pass',
      }
      const result = filterFields(updates, ARTIST_ALLOWED_UPDATE)
      expect(result).toEqual({ name: 'OK' })
    })
  })

  describe('artist bulk updates', () => {
    it('only allows status and enriched_at', () => {
      const updates = {
        enrichment_status: 'reviewed',
        enriched_at: '2026-01-01',
        name: 'hacked',
        soundcloud_url: 'hacked',
      }
      const result = filterFields(updates, ARTIST_ALLOWED_BULK)
      expect(result).toEqual({ enrichment_status: 'reviewed', enriched_at: '2026-01-01' })
    })
  })
})

describe('Admin URL construction', () => {
  it('builds correct Edge Function URL with params', () => {
    const base = 'https://example.supabase.co'
    const functionName = 'admin-festivals'
    const params = { action: 'stats' }

    const url = new URL(`${base}/functions/v1/${functionName}`)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }

    expect(url.toString()).toBe('https://example.supabase.co/functions/v1/admin-festivals?action=stats')
  })

  it('handles empty params', () => {
    const base = 'https://example.supabase.co'
    const url = new URL(`${base}/functions/v1/admin-artists`)
    expect(url.searchParams.toString()).toBe('')
  })
})
