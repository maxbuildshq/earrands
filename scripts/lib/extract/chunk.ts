/**
 * Generic "find the timetable" heuristic: locate the largest array of
 * similarly-shaped objects anywhere in a nested JSON tree (framework
 * payload, XHR body, etc). Festival lineups/timetables are always arrays
 * of near-identical records regardless of the framework — this avoids
 * hardcoding any site's schema.
 */
export type RecordArrayCandidate = {
  path: string
  items: unknown[]
  size: number // serialized chars
}

const MIN_ITEMS = 5
const MIN_KEY_OVERLAP_RATIO = 0.5

export function findRecordArrays(root: unknown, maxDepth = 12): RecordArrayCandidate[] {
  const results: RecordArrayCandidate[] = []

  function walk(value: unknown, path: string, depth: number): void {
    if (depth > maxDepth || value == null || typeof value !== 'object') return

    if (Array.isArray(value)) {
      if (value.length >= MIN_ITEMS && value.every(v => v != null && typeof v === 'object' && !Array.isArray(v))) {
        const objs = value as Record<string, unknown>[]
        const keys = new Set(Object.keys(objs[0]))
        const sample = objs.slice(0, Math.min(5, objs.length))
        const overlapOk = sample.every(o => {
          const oKeys = Object.keys(o)
          const shared = oKeys.filter(k => keys.has(k)).length
          return shared >= Math.max(1, keys.size * MIN_KEY_OVERLAP_RATIO)
        })
        if (overlapOk) {
          let size = 0
          try { size = JSON.stringify(value).length } catch { size = 0 }
          if (size > 0) results.push({ path, items: value, size })
        }
      }
      value.slice(0, 5).forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1))
      return
    }

    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k, depth + 1)
    }
  }

  walk(root, '', 0)
  return results.sort((a, b) => b.size - a.size)
}

/** Greedily pack items into chunks that each stay under a char budget. */
export function chunkItems<T>(items: T[], maxCharsPerChunk: number): T[][] {
  const chunks: T[][] = []
  let current: T[] = []
  let currentSize = 0

  for (const item of items) {
    const size = JSON.stringify(item).length
    if (current.length > 0 && currentSize + size > maxCharsPerChunk) {
      chunks.push(current)
      current = []
      currentSize = 0
    }
    current.push(item)
    currentSize += size
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}
