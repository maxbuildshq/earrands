import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useFestivals } from '../hooks/useFestivalData'
import { useAutoRedirect, isOngoing } from '../hooks/useAutoRedirect'
import { useRecapEligibility } from '../hooks/useRecapEligibility'
import { isEnded } from '../lib/recap'
import type { Festival } from '../types/database'
import { RequestFestivalCTA } from '../components/festival/RequestFestivalCTA'
import { RecapBanner } from '../components/festival/RecapBanner'
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

export function FestivalListPage() {
  const { data: festivals = [], isLoading } = useFestivals()
  const [showPast, setShowPast] = useState(false)
  const { redirectTo, isChecking } = useAutoRedirect()
  const recap = useRecapEligibility(festivals)
  const navigate = useNavigate()

  if (redirectTo) {
    posthog.capture('festival_auto_opened', { festival_slug: redirectTo.split('/')[2] })
    return <Navigate to={redirectTo} replace />
  }

  const ongoing = festivals.filter(f => isOngoing(f))
  const upcoming = festivals.filter(f => !isEnded(f) && !isOngoing(f))
  const past = festivals.filter(f => isEnded(f))

  if (isLoading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-text-secondary font-mono text-sm tracking-wider animate-pulse">LOADING FESTIVALS...</div>
      </div>
    )
  }

  return (
    <div className="pt-6 space-y-8">
      {recap && (
        <RecapBanner
          festival={recap.festival}
          level={recap.level}
          surface="list"
          onOpen={() => navigate(`/festivals/${recap.festival.slug}/schedule?recap=1`)}
        />
      )}

      <RequestFestivalCTA />

      {ongoing.length > 0 && (
        <section>
          <Heading variant="section" className="text-accent mb-3">Ongoing</Heading>
          <div className="space-y-3">
            {ongoing.map(f => (
              <FestivalCard key={f.id} festival={f} ongoing />
            ))}
          </div>
        </section>
      )}

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

function FestivalCard({ festival, ongoing }: { festival: Festival; ongoing?: boolean }) {
  const past = isEnded(festival)
  const showFollow = !past && !ongoing && !festival.timetable_announced

  return (
    <div
      className={`relative border border-border ${past ? 'bg-surface-raised/50' : 'bg-surface-raised'}`}
      style={ongoing ? { borderColor: 'var(--color-accent)', boxShadow: 'var(--shadow-now)' } : undefined}
    >
      {ongoing && (
        <div className="absolute top-0 left-0 w-1.5 h-full bg-accent animate-pulse" />
      )}
      <Link
        to={`/festivals/${festival.slug}/schedule`}
        onClick={() => posthog.capture('festival_selected', { festival_slug: festival.slug, festival_name: festival.name, is_past: past, is_ongoing: !!ongoing })}
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
            {ongoing ? (
              <Badge variant="live">Now</Badge>
            ) : past ? (
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
