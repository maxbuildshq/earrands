import { describe, it, expect } from 'vitest'
import { scParse, scBuild, igBuild, bcParse, bcBuild, discogsUrl } from './InlineEdit'

describe('soundcloud handle <-> url', () => {
  it('builds a full url from a bare handle', () => {
    expect(scBuild('user-name')).toBe('https://soundcloud.com/user-name')
  })
  it('round-trips a pasted full url without double-prefixing', () => {
    expect(scBuild('https://soundcloud.com/user-name')).toBe('https://soundcloud.com/user-name')
    expect(scBuild('https://www.soundcloud.com/user-name/')).toBe('https://soundcloud.com/user-name')
  })
  it('parses a url down to the handle', () => {
    expect(scParse('https://soundcloud.com/user-name')).toBe('user-name')
  })
  it('empty in, empty out', () => {
    expect(scBuild('')).toBe('')
  })
})

describe('instagram handle <-> url', () => {
  it('builds a full url from a bare handle', () => {
    expect(igBuild('user_name')).toBe('https://www.instagram.com/user_name')
  })
  it('round-trips a pasted full url', () => {
    expect(igBuild('https://www.instagram.com/user_name/')).toBe('https://www.instagram.com/user_name')
  })
  it('empty in, empty out', () => {
    expect(igBuild('')).toBe('')
  })
})

describe('bandcamp handle <-> url', () => {
  it('builds a subdomain url from a bare handle', () => {
    expect(bcBuild('user-name')).toBe('https://user-name.bandcamp.com')
  })
  it('round-trips a pasted full url', () => {
    expect(bcBuild('https://user-name.bandcamp.com/album/foo')).toBe('https://user-name.bandcamp.com')
  })
  it('parses a url down to the handle', () => {
    expect(bcParse('https://user-name.bandcamp.com/')).toBe('user-name')
  })
  it('empty in, empty out', () => {
    expect(bcBuild('')).toBe('')
  })
})

describe('discogsUrl', () => {
  it('builds the discogs artist url from an id', () => {
    expect(discogsUrl(12345)).toBe('https://www.discogs.com/artist/12345')
  })
})
