import { describe, it, expect } from 'vitest'
import { parseArtistName } from './artist-parser.js'

describe('parseArtistName', () => {
  describe('solo artists', () => {
    it('parses a simple name', () => {
      expect(parseArtistName('Ben UFO')).toEqual({
        collective: null,
        members: ['Ben UFO'],
        role: 'solo',
      })
    })

    it('does not split on x inside a name', () => {
      expect(parseArtistName('DAX J')).toEqual({
        collective: null,
        members: ['DAX J'],
        role: 'solo',
      })
    })

    it('strips (live) suffix', () => {
      expect(parseArtistName('Moderat (live)')).toEqual({
        collective: null,
        members: ['Moderat'],
        role: 'solo',
      })
    })

    it('strips trailing Live', () => {
      expect(parseArtistName('Moderat Live')).toEqual({
        collective: null,
        members: ['Moderat'],
        role: 'solo',
      })
    })

    it('trims whitespace', () => {
      expect(parseArtistName('  Ben Klock  ')).toEqual({
        collective: null,
        members: ['Ben Klock'],
        role: 'solo',
      })
    })
  })

  describe('B2B', () => {
    it('parses two artists B2B', () => {
      expect(parseArtistName('Ben Klock B2B Marcel Dettmann')).toEqual({
        collective: null,
        members: ['Ben Klock', 'Marcel Dettmann'],
        role: 'b2b',
      })
    })

    it('is case-insensitive', () => {
      expect(parseArtistName('Artist A b2b Artist B')).toEqual({
        collective: null,
        members: ['Artist A', 'Artist B'],
        role: 'b2b',
      })
    })
  })

  describe('F2F', () => {
    it('parses two artists F2F', () => {
      expect(parseArtistName('Artist A F2F Artist B')).toEqual({
        collective: null,
        members: ['Artist A', 'Artist B'],
        role: 'f2f',
      })
    })
  })

  describe('vs', () => {
    it('splits on vs', () => {
      expect(parseArtistName('DJ A vs DJ B')).toEqual({
        collective: null,
        members: ['DJ A', 'DJ B'],
        role: 'vs',
      })
    })
  })

  describe('x (collab)', () => {
    it('splits on space-x-space', () => {
      expect(parseArtistName('Artist A x Artist B')).toEqual({
        collective: null,
        members: ['Artist A', 'Artist B'],
        role: 'collab',
      })
    })
  })

  describe('& (collab)', () => {
    it('splits on ampersand', () => {
      expect(parseArtistName('Alarico & Ben Klock')).toEqual({
        collective: null,
        members: ['Alarico', 'Ben Klock'],
        role: 'collab',
      })
    })
  })

  describe('w/ (collective + members)', () => {
    it('parses collective with members', () => {
      expect(parseArtistName('STOOR w/ Aurora Halal, Azu Tiwaline, Barker')).toEqual({
        collective: 'STOOR',
        members: ['Aurora Halal', 'Azu Tiwaline', 'Barker'],
        role: 'member',
      })
    })

    it('handles ampersand in member list', () => {
      expect(parseArtistName('Group w/ Artist A & Artist B')).toEqual({
        collective: 'Group',
        members: ['Artist A', 'Artist B'],
        role: 'member',
      })
    })
  })

  describe('featuring', () => {
    it('parses featuring', () => {
      expect(parseArtistName('Underground Resistance featuring Saul Williams')).toEqual({
        collective: 'Underground Resistance',
        members: ['Saul Williams'],
        role: 'member',
      })
    })

    it('is case-insensitive', () => {
      expect(parseArtistName('Artist A Featuring Artist B')).toEqual({
        collective: 'Artist A',
        members: ['Artist B'],
        role: 'member',
      })
    })
  })

  describe('colon format', () => {
    it('parses collective: members', () => {
      expect(parseArtistName('LSD: Luke Slater, Steve Bicknell and Function')).toEqual({
        collective: 'LSD',
        members: ['Luke Slater', 'Steve Bicknell', 'Function'],
        role: 'member',
      })
    })
  })

  describe('parenthetical members', () => {
    it('parses collective (member & member)', () => {
      expect(parseArtistName('Collabs 3000 (Chris Liebing & Speedy J)')).toEqual({
        collective: 'Collabs 3000',
        members: ['Chris Liebing', 'Speedy J'],
        role: 'member',
      })
    })

    it('does not split parenthetical without comma or ampersand', () => {
      const result = parseArtistName('Artist (live)')
      expect(result.role).toBe('solo')
    })
  })

  describe('live status stripping', () => {
    it('strips Live before a qualifier like w/', () => {
      const result = parseArtistName('Band Live w/ Vocalist A, Vocalist B')
      expect(result.collective).toBe('Band')
      expect(result.members).toEqual(['Vocalist A', 'Vocalist B'])
    })

    it('strips Live before parenthetical', () => {
      const result = parseArtistName('Band Live (Member A & Member B)')
      expect(result.collective).toBe('Band')
      expect(result.members).toEqual(['Member A', 'Member B'])
    })
  })
})
