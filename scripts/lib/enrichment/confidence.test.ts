import { describe, it, expect } from 'vitest'
import { computeFieldConfidence, imageSourceConfidence, tierWeight, rankImageCandidate, type ResolutionEvidence } from './confidence.js'
import { extractMbEvidence, type MbEvidence } from './musicbrainz.js'

function baseEvidence(overrides: Partial<ResolutionEvidence> = {}): ResolutionEvidence {
  return {
    soundcloud_url: null,
    sc_source: null,
    instagram_url: null,
    ig_source: null,
    ig_agreeing_sources: [],
    ig_conflict: false,
    bandcamp_url: null,
    bc_source: null,
    discogs_id: null,
    discogs_links_sc: false,
    discogs_links_ig: false,
    discogs_links_bc: false,
    discogs_conflicts_sc: false,
    city: null,
    location_source: null,
    soundcloud_followers: null,
    mb: null,
    ...overrides,
  }
}

function mbWith(overrides: Partial<MbEvidence> = {}): MbEvidence {
  return {
    mb_id: 'mb-1',
    name: 'Test Artist',
    name_exact: true,
    soundcloud_urls: [],
    instagram_urls: [],
    bandcamp_urls: [],
    discogs_ids: [],
    ...overrides,
  }
}

describe('soundcloud confidence (root node)', () => {
  it('is low when not found', () => {
    const fc = computeFieldConfidence(baseEvidence())
    expect(fc.soundcloud.level).toBe('low')
  })

  it('is medium from Brave alone (no corroboration)', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/nina-kraviz', sc_source: 'brave',
    }))
    expect(fc.soundcloud.level).toBe('medium')
  })

  it('is high when MusicBrainz links the same SoundCloud', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/nina-kraviz', sc_source: 'brave',
      mb: mbWith({ soundcloud_urls: ['soundcloud.com/nina-kraviz'] }),
    }))
    expect(fc.soundcloud.level).toBe('high')
    expect(fc.soundcloud.evidence).toContain('musicbrainz entity links same SoundCloud')
  })

  it('is high when Discogs independently links the same SoundCloud', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/subfocus', sc_source: 'brave',
      discogs_links_sc: true,
    }))
    expect(fc.soundcloud.level).toBe('high')
  })

  it('does not count Discogs as corroboration when SC came FROM Discogs', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/subfocus', sc_source: 'discogs',
      discogs_links_sc: true,
    }))
    expect(fc.soundcloud.level).toBe('medium')
  })
})

describe('discogs confidence — tags, never excludes', () => {
  it('is high when MusicBrainz lists the same Discogs ID (any-of)', () => {
    const fc = computeFieldConfidence(baseEvidence({
      discogs_id: 337,
      mb: mbWith({ discogs_ids: [2702309, 337] }),
    }))
    expect(fc.discogs.level).toBe('high')
  })

  it('is high when the Discogs page links our independently-found Bandcamp', () => {
    const fc = computeFieldConfidence(baseEvidence({ discogs_id: 42, discogs_links_bc: true }))
    expect(fc.discogs.level).toBe('high')
  })

  it('is medium on a name-only match', () => {
    const fc = computeFieldConfidence(baseEvidence({ discogs_id: 42 }))
    expect(fc.discogs.level).toBe('medium')
  })

  it('is low when the Discogs page links a different SoundCloud', () => {
    const fc = computeFieldConfidence(baseEvidence({ discogs_id: 42, discogs_conflicts_sc: true }))
    expect(fc.discogs.level).toBe('low')
  })
})

describe('instagram confidence', () => {
  it('inherits SC identity confidence when SC-linked', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/x', sc_source: 'brave',
      mb: mbWith({ soundcloud_urls: ['soundcloud.com/x'] }),
      instagram_url: 'https://www.instagram.com/x', ig_source: 'soundcloud-instagram',
      ig_agreeing_sources: ['soundcloud-instagram'],
    }))
    expect(fc.instagram.level).toBe('high')
  })

  it('is high when two independent sources agree', () => {
    const fc = computeFieldConfidence(baseEvidence({
      instagram_url: 'https://www.instagram.com/x', ig_source: 'discogs-instagram',
      ig_agreeing_sources: ['discogs-instagram', 'brave-search-ig'],
    }))
    expect(fc.instagram.level).toBe('high')
  })

  it('is medium from a single source', () => {
    const fc = computeFieldConfidence(baseEvidence({
      instagram_url: 'https://www.instagram.com/x', ig_source: 'brave-search-ig',
      ig_agreeing_sources: ['brave-search-ig'],
    }))
    expect(fc.instagram.level).toBe('medium')
  })

  it('is low on conflict', () => {
    const fc = computeFieldConfidence(baseEvidence({
      instagram_url: 'https://www.instagram.com/x', ig_source: 'soundcloud-instagram',
      ig_agreeing_sources: ['soundcloud-instagram'], ig_conflict: true,
    }))
    expect(fc.instagram.level).toBe('low')
  })
})

describe('bandcamp confidence — trusted SC link alone is enough', () => {
  it('inherits high SC identity when SC-linked', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/x', sc_source: 'brave', discogs_links_sc: true,
      bandcamp_url: 'https://x.bandcamp.com', bc_source: 'soundcloud-bandcamp',
    }))
    expect(fc.bandcamp.level).toBe('high')
  })

  it('is medium from Discogs alone', () => {
    const fc = computeFieldConfidence(baseEvidence({
      bandcamp_url: 'https://x.bandcamp.com', bc_source: 'discogs-bandcamp',
    }))
    expect(fc.bandcamp.level).toBe('medium')
  })
})

describe('location and followers', () => {
  it('location never exceeds medium (artist-asserted)', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/x', sc_source: 'brave', discogs_links_sc: true,
      city: 'London', location_source: 'soundcloud-location',
    }))
    expect(fc.location.level).toBe('medium')
  })

  it('followers track SC identity confidence (platform-derived, no content caveat)', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/x', sc_source: 'brave', discogs_links_sc: true,
      soundcloud_followers: 1234,
    }))
    expect(fc.followers.level).toBe('high')
  })
})

describe('image candidate tagging + ranking', () => {
  it('candidate confidence follows its source identity', () => {
    const fc = computeFieldConfidence(baseEvidence({
      soundcloud_url: 'https://soundcloud.com/x', sc_source: 'brave', discogs_links_sc: true,
      discogs_id: 42, discogs_conflicts_sc: false,
    }))
    expect(imageSourceConfidence('soundcloud-image', fc)).toBe('high')
    expect(imageSourceConfidence('discogs-image', fc)).toBe(fc.discogs.level)
  })

  it('tier weight ranks high > medium > low', () => {
    expect(tierWeight('high')).toBeGreaterThan(tierWeight('medium'))
    expect(tierWeight('medium')).toBeGreaterThan(tierWeight('low'))
  })

  it('within the same tier, the SC avatar beats a higher-scored Discogs image', () => {
    const sc = { source: 'soundcloud-image', score: 20, confidence: 'high' as const }
    const discogs = { source: 'discogs-image', score: 95, confidence: 'high' as const }
    expect(rankImageCandidate(sc)).toBeGreaterThan(rankImageCandidate(discogs))
  })

  it('a higher tier still beats the SC avatar', () => {
    const sc = { source: 'soundcloud-image', score: 95, confidence: 'medium' as const }
    const discogs = { source: 'discogs-image', score: 20, confidence: 'high' as const }
    expect(rankImageCandidate(discogs)).toBeGreaterThan(rankImageCandidate(sc))
  })

  it('DETR score breaks ties among same-tier non-SC candidates', () => {
    const a = { source: 'discogs-image', score: 90, confidence: 'high' as const }
    const b = { source: 'discogs-image-2', score: 40, confidence: 'high' as const }
    expect(rankImageCandidate(a)).toBeGreaterThan(rankImageCandidate(b))
  })
})

describe('extractMbEvidence', () => {
  it('parses url relations into typed evidence with multiple discogs ids', () => {
    const ev = extractMbEvidence('mb-1', 'Andy C', 'Andy C', {
      relations: [
        { url: { resource: 'https://www.discogs.com/artist/337' } },
        { url: { resource: 'https://www.discogs.com/artist/2702309' } },
        { url: { resource: 'https://soundcloud.com/andyc_ram' } },
        { url: { resource: 'https://www.instagram.com/andyc_ramagram/' } },
        { url: { resource: 'https://andyc.cc' } },
      ],
    })
    expect(ev.name_exact).toBe(true)
    expect(ev.discogs_ids).toEqual([337, 2702309])
    expect(ev.soundcloud_urls).toEqual(['soundcloud.com/andyc_ram'])
    expect(ev.instagram_urls).toEqual(['instagram.com/andyc_ramagram'])
  })
})
