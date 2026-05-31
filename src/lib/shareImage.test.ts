import { describe, it, expect } from 'vitest'
import { TEMPLATES, buildShareFilename } from './shareImage.js'

describe('TEMPLATES', () => {
  it('has exactly 3 templates', () => {
    expect(TEMPLATES).toHaveLength(3)
  })

  it('each template has unique id', () => {
    const ids = TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each template has all required color fields', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.bg).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(t.accent).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(t.text).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(t.sub).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('includes the expected template ids', () => {
    const ids = TEMPLATES.map(t => t.id)
    expect(ids).toContain('acid')
    expect(ids).toContain('inverse')
    expect(ids).toContain('mono')
  })
})

describe('buildShareFilename', () => {
  it('produces a PNG filename from a festival name', () => {
    const result = buildShareFilename('Awakenings Festival 2026')
    expect(result).toMatch(/^festival-pulse-.*\.png$/)
    expect(result).toContain('awakenings')
  })

  it('strips special characters', () => {
    const result = buildShareFilename('Verknipt (Festival) — 2026!')
    expect(result).not.toMatch(/[()!—]/)
    expect(result).toContain('verknipt')
  })

  it('handles short names', () => {
    expect(buildShareFilename('ADE')).toBe('festival-pulse-ade.png')
  })
})
