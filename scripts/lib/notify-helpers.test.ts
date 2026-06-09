import { describe, it, expect } from 'vitest'
import { parseNotifyArgs, buildSubject, buildEmailHtml, buildEmailText, buildShareFilename } from './notify-helpers.js'

describe('parseNotifyArgs', () => {
  it('parses --festival slug', () => {
    const r = parseNotifyArgs(['--festival=909-2026'])
    expect(r.slug).toBe('909-2026')
    expect(r.matchTerm).toBeNull()
    expect(r.listMode).toBe(false)
    expect(r.dryRun).toBe(false)
  })

  it('parses --festival with --match-requests', () => {
    const r = parseNotifyArgs(['--festival=time-warp-2026', '--match-requests=time warp'])
    expect(r.slug).toBe('time-warp-2026')
    expect(r.matchTerm).toBe('time warp')
  })

  it('parses --list-requests', () => {
    const r = parseNotifyArgs(['--list-requests'])
    expect(r.listMode).toBe(true)
    expect(r.slug).toBeNull()
  })

  it('parses --dry-run', () => {
    const r = parseNotifyArgs(['--festival=909-2026', '--dry-run'])
    expect(r.dryRun).toBe(true)
  })

  it('handles slug with = in the value', () => {
    const r = parseNotifyArgs(['--festival=some=weird=slug'])
    expect(r.slug).toBe('some=weird=slug')
  })

  it('handles empty args', () => {
    const r = parseNotifyArgs([])
    expect(r.slug).toBeNull()
    expect(r.matchTerm).toBeNull()
    expect(r.listMode).toBe(false)
    expect(r.dryRun).toBe(false)
  })
})

describe('buildSubject', () => {
  it('returns timetable subject for follow', () => {
    expect(buildSubject('909 Festival 2026', 'follow')).toBe('The 909 Festival 2026 timetable is live')
  })

  it('returns request-added subject for request', () => {
    expect(buildSubject('Time Warp 2026', 'request')).toBe('Time Warp 2026 is now on earrands')
  })
})

describe('buildEmailHtml', () => {
  it('includes festival name and schedule URL for follow type', () => {
    const html = buildEmailHtml('909 Festival', 'https://example.com/schedule', 'follow')
    expect(html).toContain('909 Festival')
    expect(html).toContain('https://example.com/schedule')
    expect(html).toContain('timetable is live')
    expect(html).toContain('EARRANDS')
    expect(html).toContain('unfollow')
  })

  it('includes request-specific language for request type', () => {
    const html = buildEmailHtml('Time Warp', 'https://example.com/schedule', 'request')
    expect(html).toContain('the festival you requested')
    expect(html).toContain('You asked for it, we added it.')
    expect(html).toContain('you requested Time Warp')
  })

  it('includes the CTA link', () => {
    const html = buildEmailHtml('Fest', 'https://app.test/festivals/fest/schedule', 'follow')
    expect(html).toContain('href="https://app.test/festivals/fest/schedule"')
    expect(html).toContain('View the timetable')
  })
})

describe('buildEmailText', () => {
  it('builds plain text with URL for follow', () => {
    const text = buildEmailText('909 Festival', 'https://example.com', 'follow')
    expect(text).toContain('909 Festival')
    expect(text).toContain('https://example.com')
    expect(text).toContain('unfollow')
  })

  it('builds request variant', () => {
    const text = buildEmailText('Time Warp', 'https://example.com', 'request')
    expect(text).toContain('You asked for it, we added it.')
    expect(text).toContain('you requested Time Warp')
  })
})

describe('buildShareFilename', () => {
  it('lowercases and slugifies the festival name', () => {
    expect(buildShareFilename('Awakenings Festival 2026')).toBe('earrands-awakenings-festival-2026.png')
  })

  it('strips non-alphanumeric characters', () => {
    expect(buildShareFilename('909 Festival — 2026!')).toBe('earrands-909-festival-2026-.png')
  })

  it('handles simple names', () => {
    expect(buildShareFilename('Dekmantel')).toBe('earrands-dekmantel.png')
  })
})
