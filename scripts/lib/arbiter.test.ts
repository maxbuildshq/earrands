import { describe, it, expect } from 'vitest'
import { buildArbiterPrompt, readSuggestion } from './arbiter.js'
import type { Suspicion } from './parse-detector.js'

const flagged: Suspicion[] = [
  {
    raw: 'DJ One, DJ Two, DJ Three',
    parsed: { collective: null, members: ['DJ One, DJ Two, DJ Three'], role: 'solo' },
    reasons: ['comma list parsed as a single solo artist'],
  },
]

describe('buildArbiterPrompt', () => {
  const prompt = buildArbiterPrompt(flagged, ['Ben UFO', 'DJ One'])

  it('embeds cases with current parse and flag reasons', () => {
    expect(prompt).toContain('"raw": "DJ One, DJ Two, DJ Three"')
    expect(prompt).toContain('comma list parsed as a single solo artist')
  })

  it('embeds the known-artist catalogue and suggestion schema', () => {
    expect(prompt).toContain('KNOWN ARTISTS (2):')
    expect(prompt).toContain('Ben UFO, DJ One')
    expect(prompt).toContain('"confidence": "high" | "medium" | "low"')
  })
})

describe('readSuggestion', () => {
  it('accepts a well-formed entry', () => {
    expect(readSuggestion({
      raw: 'DJ One, DJ Two, DJ Three',
      collective: null,
      members: ['DJ One', 'DJ Two', 'DJ Three'],
      confidence: 'high',
      reason: 'comma-separated performer list',
    })).toEqual({
      raw: 'DJ One, DJ Two, DJ Three',
      collective: null,
      members: ['DJ One', 'DJ Two', 'DJ Three'],
      confidence: 'high',
      reason: 'comma-separated performer list',
    })
  })

  it('rejects malformed entries', () => {
    expect(readSuggestion(null)).toBeNull()
    expect(readSuggestion({ raw: '', collective: null, members: ['A'], confidence: 'high' })).toBeNull()
    expect(readSuggestion({ raw: 'X', collective: null, members: [], confidence: 'high' })).toBeNull()
    expect(readSuggestion({ raw: 'X', collective: null, members: ['A'], confidence: 'sure' })).toBeNull()
    expect(readSuggestion({ raw: 'X', collective: 5, members: ['A'], confidence: 'low' })).toBeNull()
  })

  it('defaults a missing reason to an empty string', () => {
    expect(readSuggestion({ raw: 'X', collective: null, members: ['A'], confidence: 'low' })?.reason).toBe('')
  })
})
