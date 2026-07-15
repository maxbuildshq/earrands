import { Heading } from '../ui/Heading'
import { useAdminApiUsage, type ApiUsageRow } from '../../hooks/useAdminApiUsage'

// Mirrors BUDGETS in scripts/lib/enrichment/rate-limit.ts
const BRAVE_MONTHLY_QUOTA = 1000
const BRAVE_CALLS_PER_ARTIST = 3 // SC search + IG search + bio search (full run)

const RATE_VENDORS = [
  { key: 'discogs', label: 'Discogs', rate: '60/min' },
  { key: 'soundcloud', label: 'SoundCloud', rate: '~1/s' },
  { key: 'musicbrainz', label: 'MusicBrainz', rate: '1/s' },
  { key: 'workers-ai', label: 'Workers AI', rate: '10k neurons/day free' },
] as const

function sum(rows: ApiUsageRow[], vendor: string, day?: string): number {
  return rows
    .filter(r => r.vendor === vendor && (!day || r.day === day))
    .reduce((s, r) => s + r.count, 0)
}

// Visibility first: the bar and numbers must read at a glance —
// accent while healthy, white past 70%, white-on-negative past 90%
function barState(pct: number): { fill: string; text: string } {
  if (pct >= 90) return { fill: 'bg-negative', text: 'text-white bg-negative px-1' }
  if (pct >= 70) return { fill: 'bg-white', text: 'text-white' }
  return { fill: 'bg-accent', text: 'text-accent' }
}

export function ApiBudgets() {
  const { data, isLoading } = useAdminApiUsage()
  const rows = data?.data ?? []
  const today = new Date().toISOString().slice(0, 10)

  const braveUsed = sum(rows, 'brave')
  const braveRemaining = Math.max(0, BRAVE_MONTHLY_QUOTA - braveUsed)
  const bravePct = Math.min(100, Math.round((braveUsed / BRAVE_MONTHLY_QUOTA) * 100))
  const artistsRemaining = Math.floor(braveRemaining / BRAVE_CALLS_PER_ARTIST)
  const state = barState(bravePct)

  return (
    <section className="space-y-4">
      <Heading variant="section">API Budgets</Heading>

      <div className="grid md:grid-cols-[1fr_2fr] gap-4">
        {/* Headline: the number Boss actually needs */}
        <div className={`border p-4 ${bravePct >= 90 ? 'border-negative' : 'border-accent'}`}>
          <span className={`font-mono text-5xl font-bold ${bravePct >= 90 ? 'text-negative' : 'text-accent'}`}>
            {isLoading ? '—' : `≈${artistsRemaining}`}
          </span>
          <p className="font-mono text-sm text-text-primary uppercase tracking-wider mt-1 font-bold">
            artists enrichable this month
          </p>
          <p className="font-mono text-xs text-text-secondary mt-1">
            limited by Brave Search · assumes {BRAVE_CALLS_PER_ARTIST} calls/artist (full run)
          </p>
        </div>

        {/* Brave monthly bar */}
        <div className="border border-border p-4 space-y-2">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <span className="font-mono text-sm font-bold uppercase tracking-wider text-text-primary">
              Brave Search · monthly
            </span>
            <span className={`font-mono text-2xl font-bold ${state.text}`}>
              {isLoading ? '—' : `${braveUsed} / ${BRAVE_MONTHLY_QUOTA}`}
            </span>
          </div>
          <div className="h-4 w-full bg-surface-raised border border-border">
            <div className={`h-full ${state.fill}`} style={{ width: `${bravePct}%` }} />
          </div>
          <div className="flex justify-between font-mono text-xs">
            <span className="text-text-secondary">{bravePct}% used</span>
            <span className={bravePct >= 90 ? 'text-white bg-negative px-1 font-bold' : 'text-text-primary font-bold'}>
              {braveRemaining} calls left{bravePct >= 90 ? ' · CRITICAL' : bravePct >= 70 ? ' · watch' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Rate-limited vendors: calls today (no monthly quota, pacing only) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {RATE_VENDORS.map(v => (
          <div key={v.key} className="border border-border p-4">
            <span className="font-mono text-3xl font-bold text-accent">
              {isLoading ? '—' : sum(rows, v.key, today)}
            </span>
            <p className="font-mono text-xs text-text-primary uppercase tracking-wider mt-1 font-bold">{v.label} · today</p>
            <p className="font-mono text-xs text-text-secondary mt-0.5">rate limit {v.rate}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
