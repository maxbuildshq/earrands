import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import posthog from 'posthog-js'
import { useFestival, useSets } from '../hooks/useFestivalData'
import { useSharedScheduleByCode } from '../hooks/useSharedSchedule'
import { useUserPlans } from '../hooks/useUserPlans'
import { useImportSchedule } from '../hooks/useImportSchedule'
import { useAuth } from '../hooks/useAuth'
import { SetCard } from '../components/schedule/SetCard'
import { SetSheet } from '../components/schedule/SetSheet'
import { BottomSheet } from '../components/common/BottomSheet'
import { AuthPrompt } from '../components/common/AuthPrompt'
import { Button } from '../components/ui/Button'
import { Heading } from '../components/ui/Heading'
import { formatDayLabel } from '../lib/dates'
import type { SetWithStage } from '../types/database'

export function SharedSchedulePage() {
  const { slug, code } = useParams<{ slug: string; code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: festival } = useFestival(slug)
  const { data: shared, isLoading: sharedLoading } = useSharedScheduleByCode(code)
  const { data: sets = [] } = useSets(festival?.id)
  const { planSetIds, isGoing, toggleGoing } = useUserPlans()
  const importSchedule = useImportSchedule()
  const [sheetSet, setSheetSet] = useState<SetWithStage | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  const sharedSetIds = useMemo(() => new Set(shared?.set_ids ?? []), [shared])

  useEffect(() => {
    if (shared) posthog.capture('share_link_opened', { share_code: code, set_count: shared.set_ids.length })
  }, [shared, code])

  const sharedSets = useMemo(() => {
    return sets
      .filter(s => sharedSetIds.has(s.id))
      .sort((a, b) => a.day.localeCompare(b.day) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  }, [sets, sharedSetIds])

  const allAlreadySaved = useMemo(() => {
    if (!user || sharedSets.length === 0) return false
    return sharedSets.every(s => planSetIds.has(s.id))
  }, [user, sharedSets, planSetIds])

  const handleSaveAll = () => {
    if (!user) {
      setAuthOpen(true)
      return
    }
    if (!festival) return
    importSchedule.mutate(
      { setIds: shared!.set_ids, festivalName: festival.name },
      { onSuccess: () => navigate(`/festivals/${slug}/schedule`) },
    )
  }

  if (sharedLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary font-mono text-sm">LOADING…</p>
      </div>
    )
  }

  if (!shared || sharedSets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-text-secondary font-mono text-sm">SCHEDULE NOT FOUND</p>
        <Link
          to={`/festivals/${slug}/schedule`}
          className="px-4 py-2 bg-accent text-surface font-mono font-bold text-sm uppercase tracking-wider hover:bg-accent-dim transition-colors"
        >
          Browse Schedule
        </Link>
      </div>
    )
  }

  return (
    <div className="pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-2">
      <div className="flex items-center justify-between mb-2">
        <Heading variant="content">SHARED SCHEDULE</Heading>
        <span className="text-text-secondary text-sm font-mono">{sharedSets.length} sets</span>
      </div>

      {sharedSets.map((set, i) => {
        const showDayHeader = i === 0 || sharedSets[i - 1].day !== set.day
        return (
          <div key={set.id}>
            {showDayHeader && (
              <div className="font-mono text-xs text-text-secondary uppercase tracking-wider pt-3 pb-1 border-b border-border mb-2">
                {formatDayLabel(set.day)}
              </div>
            )}
            <SetCard
              set={set}
              isNow={false}
              isGoing={isGoing(set.id)}
              rating={null}
              onToggleGoing={() => {
                if (!user) { setAuthOpen(true); return }
                toggleGoing(set.id)
              }}
              onRate={() => {
                if (!user) setAuthOpen(true)
              }}
              onOpenSheet={() => { posthog.capture('set_sheet_opened', { set_id: set.id }); setSheetSet(set) }}
            />
          </div>
        )
      })}

      <div className="pt-4 text-center">
        <Link
          to={`/festivals/${slug}/schedule`}
          className="text-text-secondary font-mono text-xs uppercase tracking-wider hover:text-text-primary transition-colors"
        >
          Browse full schedule →
        </Link>
      </div>

      <div className="fixed bottom-0 left-0 right-0 pt-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur-sm border-t border-border">
        <Button
          onClick={handleSaveAll}
          variant="primary"
          disabled={allAlreadySaved || importSchedule.isPending}
        >
          {importSchedule.isPending
            ? 'SAVING…'
            : allAlreadySaved
              ? 'Already in My Schedule'
              : 'Save to My Schedule'}
        </Button>
      </div>

      {sheetSet && (
        <SetSheet
          set={sheetSet}
          isGoing={isGoing(sheetSet.id)}
          rating={null}
          onToggleGoing={() => {
            if (!user) { setAuthOpen(true); return }
            toggleGoing(sheetSet.id)
          }}
          onRate={() => {
            if (!user) setAuthOpen(true)
          }}
          onClose={() => setSheetSet(null)}
        />
      )}

      {authOpen && (
        <BottomSheet title="SIGN UP TO SAVE" onClose={() => setAuthOpen(false)}>
          <AuthPrompt source="shared_schedule" message="Create an account to save this schedule." />
        </BottomSheet>
      )}
    </div>
  )
}
