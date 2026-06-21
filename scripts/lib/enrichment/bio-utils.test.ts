import { describe, it, expect } from 'vitest'
import { extractFestivalRootName, bioContainsFestivalName } from '../ingest-diff.js'
import { stripDiscogsMarkup } from './discogs.js'

describe('extractFestivalRootName', () => {
  it('extracts root from full festival name', () => {
    expect(extractFestivalRootName('Awakenings Upclose 2026')).toBe('Awakenings Upclose')
  })

  it('strips year and "Festival" suffix', () => {
    expect(extractFestivalRootName('Dekmantel Festival 2025')).toBe('Dekmantel')
  })

  it('handles simple names', () => {
    expect(extractFestivalRootName('Sonar 2026')).toBe('Sonar')
  })

  it('handles multi-word names', () => {
    expect(extractFestivalRootName('Hospitality on the Beach 2026')).toBe('Hospitality on')
  })
})

describe('bioContainsFestivalName', () => {
  it('detects festival name in bio', () => {
    expect(bioContainsFestivalName('At Dekmantel, she will perform a special set', 'Dekmantel')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(bioContainsFestivalName('playing at AWAKENINGS this year', 'Awakenings')).toBe(true)
  })

  it('returns false when no match', () => {
    expect(bioContainsFestivalName('Berlin-based techno producer', 'Dekmantel')).toBe(false)
  })

  it('handles multi-word root names', () => {
    expect(bioContainsFestivalName('Performing at Awakenings Upclose with a live set', 'Awakenings Upclose')).toBe(true)
  })
})

describe('stripDiscogsMarkup', () => {
  it('strips artist links', () => {
    expect(stripDiscogsMarkup('Collaborated with [a=Speedy J]')).toBe('Collaborated with Speedy J')
  })

  it('strips label links', () => {
    expect(stripDiscogsMarkup('Released on [l=Mute Records]')).toBe('Released on Mute Records')
  })

  it('strips URL tags', () => {
    expect(stripDiscogsMarkup('Visit [url=http://example.com]website[/url]')).toBe('Visit website')
  })

  it('strips bold/italic', () => {
    expect(stripDiscogsMarkup('[b]Bold[/b] and [i]italic[/i]')).toBe('Bold and italic')
  })

  it('normalizes newlines', () => {
    expect(stripDiscogsMarkup('Line 1\n\n\n\nLine 2')).toBe('Line 1\n\nLine 2')
  })
})
