import { useState, useMemo, useRef, useEffect } from 'react'
import { useFestival, useStages, useSets } from '../hooks/useFestivalData'
import { useUserPlans } from '../hooks/useUserPlans'
import { useUserRatings } from '../hooks/useUserRatings'
import { useNow, isNowPlaying } from '../hooks/useNowPlaying'
import { useAuth } from '../hooks/useAuth'
import { DayToggle } from '../components/schedule/DayToggle'
import { StageFilter } from '../components/schedule/StageFilter'
import { SetCard } from '../components/schedule/SetCard'

const DAYS = ['2026-05-16', '2026-05-17']

export function SchedulePage() {
  const { user } = useAuth()
  const { data: festival } = useFestival()
  const { data: stages = [] } = useStages(festival?.id)
  const { data: sets = [] } = useSets(festival?.id)
  const { isGoing, toggleGoing } = useUserPlans()
  const { getRating, setRating } = useUserRatings()
  const now = useNow()

  const [selectedDay, setSelectedDay] = useState(DAYS[0])
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const nowRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  useEffect(() => {
    if (stages.length > 0 && selectedStages.size === 0) {
      setSelectedStages(new Set(stages.map(s => s.id)))
    }
  }, [stages, selectedStages.size])

  const filteredSets = useMemo(() => {
    return sets
      .filter(s => s.day === selectedDay)
      .filter(s => selectedStages.has(s.stage_id))
      .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.stages.sort_order - b.stages.sort_order)
  }, [sets, selectedDay, selectedStages])

  useEffect(() => {
    if (!hasScrolled.current && nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      hasScrolled.current = true
    }
  }, [filteredSets])

  const handleToggleStage = (stageId: string) => {
    setSelectedStages(prev => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        if (next.size > 1) next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedStages(new Set(stages.map(s => s.id)))
  }

  if (!festival) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-text-secondary font-mono text-sm tracking-wider animate-pulse">LOADING TIMETABLE...</div>
      </div>
    )
  }

  return (
    <div className="pt-4">
      <DayToggle days={DAYS} selectedDay={selectedDay} onSelect={setSelectedDay} />
      <StageFilter
        stages={stages}
        selected={selectedStages}
        onToggle={handleToggleStage}
        onSelectAll={handleSelectAll}
      />

      <div className="space-y-2 mt-2">
        {filteredSets.map(set => {
          const playing = isNowPlaying(now, set.day, set.start_time, set.end_time)
          return (
            <div key={set.id} ref={playing ? nowRef : undefined}>
              <SetCard
                set={set}
                isNow={playing}
                isGoing={user ? isGoing(set.id) : false}
                rating={user ? getRating(set.id) : null}
                onToggleGoing={() => toggleGoing(set.id)}
                onRate={(v) => setRating(set.id, v)}
              />
            </div>
          )
        })}

        {filteredSets.length === 0 && (
          <div className="text-center py-12 text-text-secondary font-mono text-sm">
            No sets found for this selection.
          </div>
        )}
      </div>
    </div>
  )
}
