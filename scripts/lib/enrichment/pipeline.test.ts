import { describe, it, expect } from 'vitest'
import { resolveInstagram } from './pipeline.js'

describe('resolveInstagram', () => {
  it('prefers SoundCloud-sourced Instagram over Brave', () => {
    const notes: string[] = []
    const result = resolveInstagram([
      { url: 'https://www.instagram.com/brave_wrong', source: 'brave-search-ig' },
      { url: 'https://www.instagram.com/sc_correct', source: 'soundcloud-instagram' },
    ], notes)

    expect(result).toEqual({ url: 'https://www.instagram.com/sc_correct', source: 'soundcloud-instagram' })
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('Instagram conflict')
  })

  it('prefers Discogs-sourced Instagram over Brave', () => {
    const notes: string[] = []
    const result = resolveInstagram([
      { url: 'https://www.instagram.com/brave_wrong', source: 'brave-search-ig' },
      { url: 'https://www.instagram.com/discogs_correct', source: 'discogs-instagram' },
    ], notes)

    expect(result).toEqual({ url: 'https://www.instagram.com/discogs_correct', source: 'discogs-instagram' })
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('Instagram conflict')
  })

  it('prefers SoundCloud over Discogs when both present', () => {
    const notes: string[] = []
    const result = resolveInstagram([
      { url: 'https://www.instagram.com/discogs_one', source: 'discogs-instagram' },
      { url: 'https://www.instagram.com/sc_one', source: 'soundcloud-instagram' },
    ], notes)

    expect(result).toEqual({ url: 'https://www.instagram.com/sc_one', source: 'soundcloud-instagram' })
    expect(notes).toHaveLength(0)
  })

  it('adds no mismatch note when SC and Brave agree', () => {
    const notes: string[] = []
    const result = resolveInstagram([
      { url: 'https://www.instagram.com/same_handle', source: 'brave-search-ig' },
      { url: 'https://instagram.com/same_handle/', source: 'soundcloud-instagram' },
    ], notes)

    expect(result!.source).toBe('soundcloud-instagram')
    expect(notes).toHaveLength(0)
  })

  it('flags Brave-only Instagram for review', () => {
    const notes: string[] = []
    const result = resolveInstagram([
      { url: 'https://www.instagram.com/someone', source: 'brave-search-ig' },
    ], notes)

    expect(result).toEqual({ url: 'https://www.instagram.com/someone', source: 'brave-search-ig' })
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('no profile cross-validation')
  })

  it('uses SC Instagram with no review note when Brave is absent', () => {
    const notes: string[] = []
    const result = resolveInstagram([
      { url: 'https://www.instagram.com/artist_ig', source: 'soundcloud-instagram' },
    ], notes)

    expect(result).toEqual({ url: 'https://www.instagram.com/artist_ig', source: 'soundcloud-instagram' })
    expect(notes).toHaveLength(0)
  })

  it('flags when no candidates found', () => {
    const notes: string[] = []
    const result = resolveInstagram([], notes)

    expect(result).toBeNull()
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('No Instagram found')
  })
})
