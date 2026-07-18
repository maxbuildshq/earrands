import { describe, it, expect } from 'vitest'
import { parseArtistName } from './artist-parser.js'
import { detectSuspicions, detectBatch } from './parse-detector.js'

function suspicionsFor(raw: string, known?: Set<string>): string[] {
  return detectSuspicions(raw, parseArtistName(raw), known)
}

describe('detectSuspicions', () => {
  it('passes clean solo, collab, and b2b parses', () => {
    expect(suspicionsFor('Ben UFO')).toEqual([])
    expect(suspicionsFor('Alarico & Ben Klock')).toEqual([])
    expect(suspicionsFor('Unglued B2B Degs & Ruthless')).toEqual([])
    expect(suspicionsFor('Camo & Krooked')).toEqual([]) // known duo stays whole, not flagged
  })

  it('flags a separator token surviving inside a member', () => {
    // Hand-built parse simulating a rule miss — "B2B" survived inside a member
    const parsed = { collective: null, members: ['Artist A b2b Artist B'], role: 'solo' as const }
    expect(detectSuspicions('Artist A b2b Artist B', parsed)).toEqual([
      'separator token left inside member "Artist A b2b Artist B"',
    ])
  })

  it('flags a bare comma list falling through to solo', () => {
    expect(suspicionsFor('DJ One, DJ Two, DJ Three')).toContain(
      'comma list parsed as a single solo artist',
    )
  })

  it('flags unbalanced parentheses and implausible lengths', () => {
    const parsed = { collective: null, members: ['Broken (Name'], role: 'solo' as const }
    expect(detectSuspicions('Broken (Name', parsed)).toContain('unbalanced parentheses in member "Broken (Name"')

    const short = { collective: null, members: ['X'], role: 'solo' as const }
    expect(detectSuspicions('X', short)).toContain('implausibly short member "X"')
  })

  it('flags members and collectives unknown to the artists table', () => {
    const known = new Set(['ben ufo', 'stoor'])
    expect(suspicionsFor('Ben UFO', known)).toEqual([])
    expect(suspicionsFor('Bne UFO', known)).toEqual(['member "Bne UFO" unknown to artists table'])
    const collective = parseArtistName('STOOR w/ Aurora Halal')
    expect(detectSuspicions('STOOR w/ Aurora Halal', collective, known)).toEqual([
      'member "Aurora Halal" unknown to artists table',
    ])
  })
})

describe('detectBatch', () => {
  const entries = ['Ben UFO', 'DJ One, DJ Two, DJ Three', 'Novel Artist'].map(raw => ({
    raw,
    parsed: parseArtistName(raw),
  }))
  const known = new Set(['ben ufo'])

  it('keeps structural suspicions regardless of unknownAlone', () => {
    const out = detectBatch(entries, known, { unknownAlone: false })
    expect(out.map(s => s.raw)).toEqual(['DJ One, DJ Two, DJ Three'])
  })

  it('includes unknown-only names when unknownAlone is true', () => {
    const out = detectBatch(entries, known, { unknownAlone: true })
    expect(out.map(s => s.raw)).toEqual(['DJ One, DJ Two, DJ Three', 'Novel Artist'])
  })

  it('reports all reasons on a kept entry, including unknown-member ones', () => {
    const out = detectBatch(entries, known, { unknownAlone: false })
    expect(out[0].reasons).toContain('comma list parsed as a single solo artist')
    expect(out[0].reasons.some(r => r.includes('unknown to artists table'))).toBe(true)
  })
})
