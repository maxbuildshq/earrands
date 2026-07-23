import { describe, it, expect } from 'vitest'
import { lookupCity, titleCase, TOP_HUBS } from './cities'

describe('lookupCity', () => {
  it('matches a known hub and returns canonical casing + country code', () => {
    expect(lookupCity('berlin')).toEqual({ city: 'Berlin', country_code: 'DE' })
  })

  it('is case-insensitive', () => {
    expect(lookupCity('AMSTERDAM')?.country_code).toBe('NL')
  })

  it('is accent-insensitive', () => {
    expect(lookupCity('sao paulo')).toEqual({ city: 'São Paulo', country_code: 'BR' })
  })

  it('ignores surrounding whitespace', () => {
    expect(lookupCity('  London  ')?.country_code).toBe('GB')
  })

  it('returns null for an unknown city', () => {
    expect(lookupCity('Smalltownsville')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(lookupCity('')).toBeNull()
    expect(lookupCity('   ')).toBeNull()
  })
})

describe('titleCase', () => {
  it('capitalizes each word', () => {
    expect(titleCase('san jose')).toBe('San Jose')
  })

  it('lowercases the rest of each word', () => {
    expect(titleCase('BERLIN')).toBe('Berlin')
  })

  it('collapses extra whitespace', () => {
    expect(titleCase('  new   york  ')).toBe('New York')
  })
})

describe('TOP_HUBS', () => {
  it('surfaces 5-7 quick-pick hubs', () => {
    expect(TOP_HUBS.length).toBeGreaterThanOrEqual(5)
    expect(TOP_HUBS.length).toBeLessThanOrEqual(7)
  })
})
