import { describe, it, expect } from 'vitest'
import {
  buildSearchQuery,
  cleanArtistName,
  normalizeUrl,
  isSoundCloudProfileUrl,
  isInstagramProfileUrl,
  isComboEntry,
  extractSoundCloudUsername,
  extractInstagramHandle,
} from './name-utils.js'

describe('cleanArtistName', () => {
  it('strips (live) suffix', () => {
    expect(cleanArtistName('Speedy J (live)')).toBe('Speedy J')
  })
  it('strips (Live) case-insensitively', () => {
    expect(cleanArtistName('Function (LIVE)')).toBe('Function')
  })
  it('normalizes multiple spaces', () => {
    expect(cleanArtistName('Ben  Klock')).toBe('Ben Klock')
  })
  it('trims leading/trailing whitespace', () => {
    expect(cleanArtistName('  Nina Kraviz  ')).toBe('Nina Kraviz')
  })
  it('leaves plain names unchanged', () => {
    expect(cleanArtistName('Abstract Division')).toBe('Abstract Division')
  })
})

describe('buildSearchQuery', () => {
  it('wraps name in quotes with site filter', () => {
    expect(buildSearchQuery('Ben Klock', 'soundcloud.com')).toBe('"Ben Klock" dj music site:soundcloud.com')
  })
  it('strips (live) before building query', () => {
    expect(buildSearchQuery('Speedy J (live)', 'soundcloud.com')).toBe('"Speedy J" dj music site:soundcloud.com')
  })
  it('works for instagram.com site', () => {
    expect(buildSearchQuery('Nina Kraviz', 'instagram.com')).toBe('"Nina Kraviz" dj music site:instagram.com')
  })
})

describe('normalizeUrl', () => {
  it('removes trailing slash', () => {
    expect(normalizeUrl('https://soundcloud.com/abstractdivision/')).toBe('https://soundcloud.com/abstractdivision')
  })
  it('preserves path without trailing slash', () => {
    expect(normalizeUrl('https://www.instagram.com/abstractdivision')).toBe('https://www.instagram.com/abstractdivision')
  })
  it('returns original string on invalid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url')
  })
  it('removes multiple trailing slashes', () => {
    expect(normalizeUrl('https://soundcloud.com/alarico_katana/')).toBe('https://soundcloud.com/alarico_katana')
  })
})

describe('isSoundCloudProfileUrl', () => {
  it('accepts a valid profile URL', () => {
    expect(isSoundCloudProfileUrl('https://soundcloud.com/abstractdivision')).toBe(true)
  })
  it('accepts profile URL with trailing slash', () => {
    expect(isSoundCloudProfileUrl('https://soundcloud.com/abstractdivision/')).toBe(true)
  })
  it('rejects a track URL (2 path segments)', () => {
    expect(isSoundCloudProfileUrl('https://soundcloud.com/abstractdivision/track-name')).toBe(false)
  })
  it('rejects sets URL', () => {
    expect(isSoundCloudProfileUrl('https://soundcloud.com/abstractdivision/sets/my-set')).toBe(false)
  })
  it('rejects reserved name: discover', () => {
    expect(isSoundCloudProfileUrl('https://soundcloud.com/discover')).toBe(false)
  })
  it('rejects reserved name: search', () => {
    expect(isSoundCloudProfileUrl('https://soundcloud.com/search')).toBe(false)
  })
  it('rejects non-SoundCloud URLs', () => {
    expect(isSoundCloudProfileUrl('https://instagram.com/benklock')).toBe(false)
  })
  it('rejects bare soundcloud.com', () => {
    expect(isSoundCloudProfileUrl('https://soundcloud.com')).toBe(false)
  })
})

describe('isInstagramProfileUrl', () => {
  it('accepts a valid profile URL', () => {
    expect(isInstagramProfileUrl('https://www.instagram.com/abstractdivision')).toBe(true)
  })
  it('accepts profile URL without www', () => {
    expect(isInstagramProfileUrl('https://instagram.com/benklock')).toBe(true)
  })
  it('rejects a post URL (/p/)', () => {
    expect(isInstagramProfileUrl('https://www.instagram.com/p/abc123')).toBe(false)
  })
  it('rejects explore', () => {
    expect(isInstagramProfileUrl('https://www.instagram.com/explore')).toBe(false)
  })
  it('rejects reels', () => {
    expect(isInstagramProfileUrl('https://www.instagram.com/reels')).toBe(false)
  })
  it('rejects non-Instagram URLs', () => {
    expect(isInstagramProfileUrl('https://soundcloud.com/benklock')).toBe(false)
  })
})

describe('isComboEntry', () => {
  it('flags B2B non-collective as combo', () => {
    expect(isComboEntry('ben klock b2b nina kraviz', false)).toBe(true)
  })
  it('flags & non-collective as combo', () => {
    expect(isComboEntry('artist a & artist b', false)).toBe(true)
  })
  it('flags vs non-collective as combo', () => {
    expect(isComboEntry('artist a vs artist b', false)).toBe(true)
  })
  it('flags f2f non-collective as combo', () => {
    expect(isComboEntry('artist a f2f artist b', false)).toBe(true)
  })
  it('does not flag a collective', () => {
    expect(isComboEntry('ben klock b2b nina kraviz', true)).toBe(false)
  })
  it('does not flag a solo artist', () => {
    expect(isComboEntry('ben klock', false)).toBe(false)
  })
  it('does not flag a name with b2b as substring (no spaces)', () => {
    expect(isComboEntry('dax j', false)).toBe(false)
  })
})

describe('extractSoundCloudUsername', () => {
  it('extracts username from profile URL', () => {
    expect(extractSoundCloudUsername('https://soundcloud.com/abstractdivision')).toBe('abstractdivision')
  })
  it('returns null for non-SoundCloud URL', () => {
    expect(extractSoundCloudUsername('https://instagram.com/benklock')).toBe(null)
  })
  it('returns null for invalid URL', () => {
    expect(extractSoundCloudUsername('not-a-url')).toBe(null)
  })
})

describe('extractInstagramHandle', () => {
  it('extracts handle from profile URL', () => {
    expect(extractInstagramHandle('https://www.instagram.com/abstractdivision')).toBe('abstractdivision')
  })
  it('returns null for non-Instagram URL', () => {
    expect(extractInstagramHandle('https://soundcloud.com/benklock')).toBe(null)
  })
  it('returns null for invalid URL', () => {
    expect(extractInstagramHandle('not-a-url')).toBe(null)
  })
})
