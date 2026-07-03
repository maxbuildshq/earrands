import { describe, it, expect } from 'vitest'
import { TEMPLATES, buildShareFilename } from './shareImage.js'

describe('TEMPLATES', () => {
  it('has exactly the poster and acid templates, in that order', () => {
    expect(TEMPLATES.map(t => t.id)).toEqual(['poster', 'acid'])
  })

  it('each template has all required color fields', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.bg).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(t.ink).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(t.accent).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(t.rule).toBeTruthy()
    }
  })
})

describe('buildShareFilename', () => {
  it('produces a PNG filename from a festival name', () => {
    const result = buildShareFilename('Awakenings Festival 2026')
    expect(result).toMatch(/^earrands-.*\.png$/)
    expect(result).toContain('awakenings')
  })

  it('strips special characters', () => {
    const result = buildShareFilename('Verknipt (Festival) — 2026!')
    expect(result).not.toMatch(/[()!—]/)
    expect(result).toContain('verknipt')
  })

  it('handles short names', () => {
    expect(buildShareFilename('ADE')).toBe('earrands-ade.png')
  })

  it('numbers pages in multi-image exports', () => {
    expect(buildShareFilename('ADE', 2, 3)).toBe('earrands-ade-2of3.png')
  })

  it('omits the page suffix for a single image', () => {
    expect(buildShareFilename('ADE', 1, 1)).toBe('earrands-ade.png')
  })
})
