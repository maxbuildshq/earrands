/**
 * First-session onboarding hints — pure logic + localStorage flags.
 * Strategy: docs/onboarding-strategy.md. One hint visible at a time, shown in
 * priority order, capped per page-load session; dismiss = never shown again
 * (per-device `onboarding:{hintId}` flag).
 */

// 'offline' is defined but not in the active order yet — re-add it once we want it live.
export type HintId = 'set_sheet' | 'picks' | 'share' | 'stage_filter' | 'offline'

export const HINT_ORDER: readonly HintId[] = ['set_sheet', 'picks', 'share', 'stage_filter']

export const SESSION_HINT_CAP = 2

export function nextHint(seen: ReadonlySet<string>, shownThisSession: number): HintId | null {
  if (shownThisSession >= SESSION_HINT_CAP) return null
  return HINT_ORDER.find(id => !seen.has(id)) ?? null
}

const storageKey = (id: string) => `onboarding:${id}`

export function getSeenHints(): Set<string> {
  const seen = new Set<string>()
  try {
    for (const id of HINT_ORDER) {
      if (localStorage.getItem(storageKey(id))) seen.add(id)
    }
  } catch { /* ignore */ }
  return seen
}

export function markHintSeen(id: HintId) {
  try { localStorage.setItem(storageKey(id), '1') } catch { /* ignore */ }
}
