import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFestival, useSets } from '../hooks/useFestivalData'
import { useUserPlans } from '../hooks/useUserPlans'
import { useUserRatings } from '../hooks/useUserRatings'
import { useNow, isNowPlaying } from '../hooks/useNowPlaying'
import { SetCard } from '../components/schedule/SetCard'
import { SetSheet } from '../components/schedule/SetSheet'
import { ShareScheduleSheet } from '../components/festival/ShareScheduleSheet'
import { formatDayLabel } from '../lib/dates'
import type { SetWithStage } from '../types/database'

function hasConflict(a: SetWithStage, b: SetWithStage): boolean {
  if (a.day !== b.day) return false
  if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) return false
  return a.start_time < b.end_time && b.start_time < a.end_time
}

export function MySchedulePage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: festival } = useFestival(slug)
  const { data: sets = [] } = useSets(festival?.id)
  const { planSetIds, isGoing, toggleGoing } = useUserPlans()
  const { getRating, setRating } = useUserRatings()
  const now = useNow()
  const [sheetSet, setSheetSet] = useState<SetWithStage | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const mySets = useMemo(() => {
    return sets
      .filter(s => planSetIds.has(s.id))
      .sort((a, b) => a.day.localeCompare(b.day) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  }, [sets, planSetIds])

  const conflictIds = useMemo(() => {
    const ids = new Set<string>()
    for (let i = 0; i < mySets.length; i++) {
      for (let j = i + 1; j < mySets.length; j++) {
        if (hasConflict(mySets[i], mySets[j])) {
          ids.add(mySets[i].id)
          ids.add(mySets[j].id)
        }
      }
    }
    return ids
  }, [mySets])

  if (mySets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-text-secondary font-mono text-sm">NO SETS MARKED YET</p>
        <Link
          to={`/festivals/${slug}/schedule`}
          className="px-4 py-2 bg-acid text-surface font-mono font-bold text-sm uppercase tracking-wider hover:bg-acid-dim transition-colors"
        >
          Browse Schedule
        </Link>
      </div>
    )
  }

  return (
    <div className="pt-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-mono font-bold text-lg text-acid tracking-tight">MY SETS</h1>
        <div className="flex items-center gap-3">
          <span className="text-text-secondary text-sm font-mono">{mySets.length} sets</span>
          <button
            onClick={() => setShareOpen(true)}
            className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border border-acid text-acid hover:bg-acid hover:text-surface transition-colors"
          >
            Share
          </button>
        </div>
      </div>

      {mySets.map((set, i) => {
        const showDayHeader = i === 0 || mySets[i - 1].day !== set.day
        const playing = set.start_time && set.end_time
          ? isNowPlaying(now, set.day, set.start_time, set.end_time)
          : false

        return (
          <div key={set.id}>
            {showDayHeader && (
              <div className="font-mono text-xs text-text-secondary uppercase tracking-wider pt-3 pb-1 border-b border-border mb-2">
                {formatDayLabel(set.day)}
              </div>
            )}
            <SetCard
              set={set}
              isNow={playing}
              isGoing={isGoing(set.id)}
              rating={getRating(set.id)}
              onToggleGoing={() => toggleGoing(set.id)}
              onRate={(v) => setRating(set.id, v)}
              onOpenSheet={() => setSheetSet(set)}
              showConflict={conflictIds.has(set.id)}
            />
          </div>
        )
      })}

      {sheetSet && (
        <SetSheet
          set={sheetSet}
          isGoing={isGoing(sheetSet.id)}
          rating={getRating(sheetSet.id)}
          onToggleGoing={() => toggleGoing(sheetSet.id)}
          onRate={(v) => setRating(sheetSet.id, v)}
          onClose={() => setSheetSet(null)}
        />
      )}

      {shareOpen && festival && (
        <ShareScheduleSheet
          festivalName={festival.name}
          sets={mySets}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}
