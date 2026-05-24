import { Link } from 'react-router-dom'
import { useFestivals } from '../hooks/useFestivalData'
import type { Festival } from '../types/database'

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}-${e.toLocaleDateString('en-GB', opts)} ${s.getFullYear()}`
  }
  return `${s.toLocaleDateString('en-GB', opts)} - ${e.toLocaleDateString('en-GB', opts)} ${s.getFullYear()}`
}

function isPast(festival: Festival): boolean {
  const end = new Date(festival.end_date + 'T23:59:59')
  return end < new Date()
}

export function FestivalListPage() {
  const { data: festivals = [], isLoading } = useFestivals()

  const upcoming = festivals.filter(f => !isPast(f))
  const past = festivals.filter(f => isPast(f))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-text-secondary font-mono text-sm tracking-wider animate-pulse">LOADING FESTIVALS...</div>
      </div>
    )
  }

  return (
    <div className="pt-6 space-y-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="font-mono font-bold text-xs text-acid uppercase tracking-widest mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map(f => (
              <FestivalCard key={f.id} festival={f} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-mono font-bold text-xs text-text-secondary uppercase tracking-widest mb-3">Past</h2>
          <div className="space-y-3">
            {past.map(f => (
              <FestivalCard key={f.id} festival={f} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function FestivalCard({ festival }: { festival: Festival }) {
  const past = isPast(festival)

  return (
    <Link
      to={`/festivals/${festival.slug}/schedule`}
      className={`block border border-border p-4 transition-colors hover:border-acid/50 ${
        past ? 'bg-surface-raised/50' : 'bg-surface-raised'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono font-bold text-base text-text-primary">{festival.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
            <span>{formatDateRange(festival.start_date, festival.end_date)}</span>
            {festival.location && (
              <>
                <span className="text-border">·</span>
                <span>{festival.location}</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {past ? (
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold border border-border text-text-secondary uppercase">
              Past
            </span>
          ) : festival.timetable_announced ? (
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-acid text-surface uppercase">
              Timetable
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold border border-acid text-acid uppercase">
              Lineup
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
