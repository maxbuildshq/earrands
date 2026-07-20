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

    it('splits an unprotected "&" pair embedded in a B2B chain', () => {
      expect(parseArtistName('Unglued B2B Degs & Ruthless')).toEqual({
        collective: null,
        members: ['Unglued', 'Degs', 'Ruthless'],
        role: 'b2b',
      })
    })

    it('splits an unprotected "&" pair at the start of a B2B chain', () => {
      expect(parseArtistName('Flava D & LowQui B2B S.P.Y')).toEqual({
        collective: null,
        members: ['Flava D', 'LowQui', 'S.P.Y'],
        role: 'b2b',
      })
    })

    it('keeps a whitelisted duo intact inside a B2B chain', () => {
      expect(parseArtistName('Unglued B2B Camo & Krooked')).toEqual({
        collective: null,
        members: ['Unglued', 'Camo & Krooked'],
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

  describe('descriptor brackets', () => {
    it('strips descriptor parens for parsing but treats as solo', () => {
      expect(parseArtistName('Nu:Tone (Soul & Rare Groove Set)')).toEqual({
        collective: null,
        members: ['Nu:Tone'],
        role: 'solo',
      })
    })

    it('strips 140 Set descriptor', () => {
      expect(parseArtistName('Savannah (140 Set)')).toEqual({
        collective: null,
        members: ['Savannah'],
        role: 'solo',
      })
    })

    it('strips FKA descriptor', () => {
      expect(parseArtistName('Lou Nour (FKA Sicaria) & Koast')).toEqual({
        collective: null,
        members: ['Lou Nour', 'Koast'],
        role: 'collab',
      })
    })

    it('strips DJ Set descriptor', () => {
      expect(parseArtistName('Jakes (DJ Set) & Javeon')).toEqual({
        collective: null,
        members: ['Jakes', 'Javeon'],
        role: 'collab',
      })
    })

    it('still parses member brackets without descriptor keywords', () => {
      expect(parseArtistName('Virus Trinity (Ed Rush B2B Optical B2B Audio)')).toEqual({
        collective: 'Virus Trinity',
        members: ['Ed Rush', 'Optical', 'Audio'],
        role: 'member',
      })
    })

    it('parses Run In The Jungle with member parens and extra collaborator', () => {
      expect(parseArtistName('Run In The Jungle (T>I & D*Minds) & Carasel')).toEqual({
        collective: 'Run In The Jungle',
        members: ['T>I', 'D*Minds', 'Carasel'],
        role: 'member',
      })
    })

    it('strips opening ceremony descriptor', () => {
      expect(parseArtistName('James Holden & Surgeon (opening ceremony)')).toEqual({
        collective: null,
        members: ['James Holden', 'Surgeon'],
        role: 'collab',
      })
    })
  })

  describe('presents / debuts (show concept, not a member)', () => {
    it('drops the concept name after "presents"', () => {
      expect(parseArtistName('A Guy Called Gerald presents Black Secret Technology')).toEqual({
        collective: null,
        members: ['A Guy Called Gerald'],
        role: 'solo',
      })
    })

    it('drops the concept name after "debuts"', () => {
      expect(parseArtistName('Jeff Mills debuts STARGATE')).toEqual({
        collective: null,
        members: ['Jeff Mills'],
        role: 'solo',
      })
    })

    it('still splits a compound presenter before the concept name', () => {
      expect(parseArtistName('James Holden & Surgeon present Group Therapy')).toEqual({
        collective: null,
        members: ['James Holden', 'Surgeon'],
        role: 'collab',
      })
    })

    it('extracts featured artists from the concept part', () => {
      expect(parseArtistName('UR presents Depth Charge featuring Saul Williams')).toEqual({
        collective: null,
        members: ['UR', 'Saul Williams'],
        role: 'collab',
      })
    })

    it('drops a singular possessive show concept', () => {
      expect(parseArtistName("Eris Drew's Mystery Of The Motherbeat")).toEqual({
        collective: null,
        members: ['Eris Drew'],
        role: 'solo',
      })
    })

    it('drops a plural possessive show concept, keeping the owner name intact', () => {
      expect(parseArtistName("DJ Sprinkles' Deeperama")).toEqual({
        collective: null,
        members: ['DJ Sprinkles'],
        role: 'solo',
      })
    })
  })

  describe('hosted by', () => {
    it('splits main act from hosted MC', () => {
      expect(parseArtistName('Serum hosted by Carasel')).toEqual({
        collective: null,
        members: ['Serum', 'Carasel'],
        role: 'member',
      })
    })
  })

  describe('ft. / feat.', () => {
    it('parses ft.', () => {
      expect(parseArtistName('Doktor ft. Kanobie')).toEqual({
        collective: 'Doktor',
        members: ['Kanobie'],
        role: 'member',
      })
    })

    it('parses feat.', () => {
      expect(parseArtistName('Artist A feat. Artist B')).toEqual({
        collective: 'Artist A',
        members: ['Artist B'],
        role: 'member',
      })
    })
  })

  describe('case-insensitive separators', () => {
    it('splits on uppercase X', () => {
      expect(parseArtistName('P Money X Whiney')).toEqual({
        collective: null,
        members: ['P Money', 'Whiney'],
        role: 'collab',
      })
    })

    it('splits on uppercase VS', () => {
      expect(parseArtistName('Artist A VS Artist B')).toEqual({
        collective: null,
        members: ['Artist A', 'Artist B'],
        role: 'vs',
      })
    })
  })

  describe('colon-name guard', () => {
    it('does not split En:Vy as a collective', () => {
      expect(parseArtistName('En:Vy')).toEqual({
        collective: null,
        members: ['En:Vy'],
        role: 'solo',
      })
    })

    it('does not split Nu:Tone as a collective', () => {
      expect(parseArtistName('Nu:Tone & SP:MC')).toEqual({
        collective: null,
        members: ['Nu:Tone', 'SP:MC'],
        role: 'collab',
      })
    })

    it('still parses real colon collectives', () => {
      expect(parseArtistName('LSD: Luke Slater, Steve Bicknell and Function')).toEqual({
        collective: 'LSD',
        members: ['Luke Slater', 'Steve Bicknell', 'Function'],
        role: 'member',
      })
    })
  })

  describe('known-duo allowlist', () => {
    it('does not split Blasha & Allatt', () => {
      expect(parseArtistName('Blasha & Allatt')).toEqual({
        collective: null,
        members: ['Blasha & Allatt'],
        role: 'solo',
      })
    })

    it('does not split Camo & Krooked', () => {
      expect(parseArtistName('Camo & Krooked')).toEqual({
        collective: null,
        members: ['Camo & Krooked'],
        role: 'solo',
      })
    })

    it('keeps Camo & Krooked together when with other artists', () => {
      expect(parseArtistName('Camo & Krooked & Daxta')).toEqual({
        collective: null,
        members: ['Camo & Krooked', 'Daxta'],
        role: 'collab',
      })
    })

    it('keeps Pola & Bryson together', () => {
      expect(parseArtistName('Pola & Bryson & Linguistics')).toEqual({
        collective: null,
        members: ['Pola & Bryson', 'Linguistics'],
        role: 'collab',
      })
    })

    it('keeps Ed Rush & Optical in B2B', () => {
      expect(parseArtistName('Ed Rush & Optical B2B Audio')).toEqual({
        collective: null,
        members: ['Ed Rush & Optical', 'Audio'],
        role: 'b2b',
      })
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
