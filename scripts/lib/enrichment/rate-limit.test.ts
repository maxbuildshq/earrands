import { describe, it, expect } from 'vitest'
import { estimateRunBudget, recordUsage, pendingUsage, BUDGETS } from './rate-limit.js'

describe('estimateRunBudget', () => {
  it('full run costs SC + IG + bio searches per artist', () => {
    const b = estimateRunBudget(100, undefined, 0)
    expect(b.braveCalls).toBe(300)
    expect(b.fits).toBe(true)
  })

  it('field-scoped runs only count fields that hit Brave', () => {
    expect(estimateRunBudget(50, ['image', 'followers'], 0).braveCalls).toBe(0)
    expect(estimateRunBudget(50, ['instagram'], 0).braveCalls).toBe(50)
    expect(estimateRunBudget(50, ['soundcloud', 'bio'], 0).braveCalls).toBe(100)
  })

  it('flags runs that exceed the remaining monthly budget', () => {
    const b = estimateRunBudget(400, undefined, BUDGETS.brave.monthly - 100)
    expect(b.braveRemaining).toBe(100)
    expect(b.fits).toBe(false)
  })
})

describe('recordUsage', () => {
  it('accumulates counts per vendor', () => {
    recordUsage('discogs')
    recordUsage('discogs', 2)
    expect(pendingUsage().discogs).toBe(3)
  })
})
