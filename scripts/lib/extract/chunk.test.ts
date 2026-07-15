import { describe, it, expect } from 'vitest'
import { findRecordArrays, chunkItems } from './chunk.js'

describe('findRecordArrays', () => {
  it('finds an array of similarly-shaped objects nested under opaque keys', () => {
    const payload = {
      nRKYEnPpme: {
        components: [
          { type: 'Hero' },
          {
            type: 'ArtistList',
            data: {
              artists: Array.from({ length: 10 }, (_, i) => ({
                slug: `artist-${i}`, name: `Artist ${i}`, timeslots: [{ timeStart: '2026-08-01T20:00:00Z' }],
              })),
            },
          },
        ],
      },
      other: { mainNavigation: [{ label: 'Home' }, { label: 'Program' }] },
    }
    const results = findRecordArrays(payload)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].path).toContain('artists')
    expect(results[0].items).toHaveLength(10)
  })

  it('ignores short arrays and arrays of non-object items', () => {
    const payload = { tags: ['a', 'b', 'c'], few: [{ a: 1 }, { a: 2 }] }
    expect(findRecordArrays(payload)).toEqual([])
  })

  it('ignores arrays whose objects share no common shape', () => {
    const payload = {
      mixed: [
        { a: 1, b: 2 }, { c: 3, d: 4 }, { e: 5, f: 6 }, { g: 7, h: 8 }, { i: 9, j: 10 },
      ],
    }
    expect(findRecordArrays(payload)).toEqual([])
  })

  it('ranks larger candidates first', () => {
    const small = Array.from({ length: 5 }, (_, i) => ({ a: i }))
    const big = Array.from({ length: 5 }, (_, i) => ({ a: i, b: 'x'.repeat(200) }))
    const results = findRecordArrays({ small, big })
    expect(results[0].path).toBe('big')
  })
})

describe('chunkItems', () => {
  it('packs items under the char budget per chunk', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, text: 'x'.repeat(50) }))
    const chunks = chunkItems(items, 200)
    expect(chunks.flat()).toHaveLength(10)
    for (const c of chunks) {
      const size = JSON.stringify(c).length
      // last item in a chunk may push slightly over on its own, but never doubles the budget
      expect(size).toBeLessThan(400)
    }
  })

  it('always keeps at least one item per chunk even if oversized', () => {
    const items = [{ huge: 'x'.repeat(1000) }]
    const chunks = chunkItems(items, 10)
    expect(chunks).toEqual([items])
  })

  it('returns a single chunk when everything fits', () => {
    const items = [{ a: 1 }, { a: 2 }]
    expect(chunkItems(items, 10_000)).toEqual([items])
  })
})
