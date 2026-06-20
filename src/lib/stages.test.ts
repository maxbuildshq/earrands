import { describe, it, expect } from 'vitest'
import { orderVisibleStages } from './stages'
import type { Stage } from '../types/database'

const mk = (id: string, sort_order: number): Stage => ({ id, festival_id: 'f', name: id, sort_order })
const ids = (stages: Stage[]) => stages.map(s => s.id)

describe('orderVisibleStages', () => {
  const stages = [mk('a', 0), mk('b', 1), mk('c', 2), mk('d', 3)]

  it('sorts by sort_order when nothing hidden or pinned', () => {
    expect(ids(orderVisibleStages(stages, new Set(), []))).toEqual(['a', 'b', 'c', 'd'])
  })
  it('excludes hidden stages', () => {
    expect(ids(orderVisibleStages(stages, new Set(['b', 'd']), []))).toEqual(['a', 'c'])
  })
  it('puts pinned stages first in pin order, rest by sort_order', () => {
    expect(ids(orderVisibleStages(stages, new Set(), ['c', 'a']))).toEqual(['c', 'a', 'b', 'd'])
  })
  it('drops a pinned stage that is also hidden', () => {
    expect(ids(orderVisibleStages(stages, new Set(['c']), ['c', 'a']))).toEqual(['a', 'b', 'd'])
  })
})
