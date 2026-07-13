// Shared rate limiting + API usage accounting (ADR 011, Phase 1g).
// Every outbound client records real API consumption here (dry runs included —
// the call happened); enrich-artists flushes counts to api_usage at run end,
// where the admin dashboard reads them.

import type { SupabaseClient } from '@supabase/supabase-js'

export type Vendor = 'brave' | 'discogs' | 'soundcloud' | 'musicbrainz' | 'workers-ai'

// Hard vendor pacing (min ms between calls). Monthly/daily quotas live in BUDGETS.
const MIN_INTERVAL_MS: Record<Vendor, number> = {
  brave: 350,          // free tier ~1 rps
  discogs: 1000,       // 60/min
  soundcloud: 1000,    // be polite, ~1 rps
  musicbrainz: 1100,   // hard 1 rps + UA policy
  'workers-ai': 200,
}

export const BUDGETS = {
  brave: { monthly: Number(process.env.BRAVE_MONTHLY_QUOTA ?? 2000) },
  // Assumed Brave calls per artist on a full run (SC search + IG search + bio search)
  braveCallsPerArtist: 3,
} as const

const usage = new Map<Vendor, number>()
const lastCall = new Map<Vendor, number>()

export function recordUsage(vendor: Vendor, n = 1): void {
  usage.set(vendor, (usage.get(vendor) ?? 0) + n)
}

export function pendingUsage(): Record<string, number> {
  return Object.fromEntries(usage)
}

// Min-interval throttle for clients without their own pacing sleeps
export async function throttle(vendor: Vendor): Promise<void> {
  const now = Date.now()
  const waitMs = (lastCall.get(vendor) ?? 0) + MIN_INTERVAL_MS[vendor] - now
  lastCall.set(vendor, Math.max(now, now + waitMs))
  if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs))
}

// Atomic per-vendor daily increments via increment_api_usage (migration 037)
export async function flushUsage(supabase: SupabaseClient): Promise<void> {
  for (const [vendor, count] of usage) {
    if (count === 0) continue
    const { error } = await supabase.rpc('increment_api_usage', { v: vendor, n: count })
    if (error) {
      console.warn(`  api_usage flush failed for ${vendor}: ${error.message}`)
    } else {
      usage.set(vendor, 0)
    }
  }
}

export async function fetchMonthUsage(supabase: SupabaseClient, vendor: Vendor): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  const { data } = await supabase
    .from('api_usage')
    .select('count')
    .eq('vendor', vendor)
    .gte('day', monthStart.toISOString().slice(0, 10))
  return (data ?? []).reduce((sum, r) => sum + r.count, 0)
}

// Preflight: what a run will roughly cost vs what's left this month.
// Brave is the binding monthly constraint; other vendors are rate-limited only.
export function estimateRunBudget(artistCount: number, fields: string[] | undefined, braveUsedThisMonth: number): {
  braveCalls: number
  braveRemaining: number
  fits: boolean
} {
  const full = !fields
  const perArtist =
    (full || fields.includes('soundcloud') ? 1 : 0) +
    (full || fields.includes('instagram') ? 1 : 0) +
    (full || fields.includes('bio') ? 1 : 0)
  const braveCalls = artistCount * perArtist
  const braveRemaining = BUDGETS.brave.monthly - braveUsedThisMonth
  return { braveCalls, braveRemaining, fits: braveCalls <= braveRemaining }
}
