import type { Stage } from '../types/database'

/**
 * Visible stages ordered for the timetable lanes: pinned stages first (in pin order, visible only),
 * then the remaining visible stages by `sort_order`. Hidden stages are excluded entirely.
 */
export function orderVisibleStages(stages: Stage[], hidden: Set<string>, pinned: string[]): Stage[] {
  const visible = stages.filter(s => !hidden.has(s.id))
  const pinnedSet = new Set(pinned)
  const pinnedVisible = pinned
    .map(id => visible.find(s => s.id === id))
    .filter((s): s is Stage => !!s)
  const rest = visible
    .filter(s => !pinnedSet.has(s.id))
    .sort((a, b) => a.sort_order - b.sort_order)
  return [...pinnedVisible, ...rest]
}
