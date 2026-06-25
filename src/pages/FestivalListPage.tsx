import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFestivals } from '../hooks/useFestivalData'
import type { Festival } from '../types/database'
import { RequestFestivalCTA } from '../components/festival/RequestFestivalCTA'
import { FollowButton } from '../components/festival/FollowButton'
import { Heading } from '../components/ui/Heading'
import { Badge } from '../components/ui/Badge'
import posthog from 'posthog-js'

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
  const [showPast, setShowPast] = useState(false)

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
      <RequestFestivalCTA />

      {upcoming.length > 0 && (
        <section>
          <Heading variant="section" className="text-accent mb-3">Upcoming</Heading>
          <div className="space-y-3">
            {upcoming.map(f => (
              <FestivalCard key={f.id} festival={f} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <button onClick={() => setShowPast(p => !p)} className="block mb-3">
            <Heading as="span" variant="section" className="text-text-secondary hover:text-accent transition-colors">
              {showPast ? `Collapse past (${past.length})` : `Show past (${past.length})`}
            </Heading>
          </button>
          {showPast && (
            <div className="space-y-3">
              {past.map(f => (
                <FestivalCard key={f.id} festival={f} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function FestivalCard({ festival }: { festival: Festival }) {
  const past = isPast(festival)
  const showFollow = !past && !festival.timetable_announced

  return (
    <div className={`border border-border ${past ? 'bg-surface-raised/50' : 'bg-surface-raised'}`}>
      <Link
        to={`/festivals/${festival.slug}/schedule`}
        onClick={() => posthog.capture('festival_selected', { festival_slug: festival.slug, festival_name: festival.name, is_past: past })}
        className="block p-4 transition-colors hover:bg-surface-hover"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <Heading variant="card">{festival.name}</Heading>
            <div className="flex items-center gap-2 mt-1 text-base text-text-secondary">
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
              <Badge variant="outline">Past</Badge>
            ) : festival.timetable_announced ? (
              <Badge variant="accent">Timetable</Badge>
            ) : (
              <Badge variant="accent-outline">Lineup</Badge>
            )}
          </div>
        </div>
      </Link>

      {showFollow && (
        <div className="border-t border-border px-4 py-2 flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-text-secondary uppercase tracking-wider">Timetable not out yet</span>
          <FollowButton festivalId={festival.id} />
        </div>
      )}
    </div>
  )
}
