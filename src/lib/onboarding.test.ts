import { describe, it, expect } from 'vitest'
import { HINT_ORDER, SESSION_HINT_CAP, nextHint } from './onboarding'

describe('nextHint', () => {
  it('returns the first hint for a fresh user', () => {
    expect(nextHint(new Set(), 0)).toBe('set_sheet')
  })

  it('skips seen hints in priority order', () => {
    expect(nextHint(new Set(['set_sheet']), 0)).toBe('picks')
    expect(nextHint(new Set(['set_sheet', 'picks']), 0)).toBe('share')
  })

  it('returns null once the session cap is reached', () => {
    expect(nextHint(new Set(), SESSION_HINT_CAP)).toBeNull()
  })

  it('returns null when every hint has been seen', () => {
    expect(nextHint(new Set(HINT_ORDER), 0)).toBeNull()
  })
})
