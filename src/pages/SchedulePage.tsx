import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useFestival, useStages, useSets } from '../hooks/useFestivalData'
import { useUserPlans } from '../hooks/useUserPlans'
import { useUserRatings } from '../hooks/useUserRatings'
import { useNow, isNowPlaying } from '../hooks/useNowPlaying'
import { useAuth } from '../hooks/useAuth'
import { DayToggle } from '../components/schedule/DayToggle'
import { StageFilter } from '../components/schedule/StageFilter'
import { SetCard } from '../components/schedule/SetCard'
import { LineupView } from '../components/schedule/LineupView'
import { getDays } from '../lib/dates'

export function SchedulePage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const { data: festival } = useFestival(slug)
  const { data: stages = [] } = useStages(festival?.id)
  const { data: sets = [] } = useSets(festival?.id)
  const { isGoing, toggleGoing } = useUserPlans()
  const { getRating, setRating } = useUserRatings()
  const now = useNow()

  const days = useMemo(() => festival ? getDays(festival.start_date, festival.end_date) : [], [festival])

  const [selectedDay, setSelectedDay] = useState<string>('')
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const nowRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  // Set initial day when festival loads
  useEffect(() => {
    if (days.length > 0 && !selectedDay) {
      setSelectedDay(days[0])
    }
  }, [days, selectedDay])

  useEffect(() => {
    if (stages.length > 0 && selectedStages.size === 0) {
      setSelectedStages(new Set(stages.map(s => s.id)))
    }
  }, [stages, selectedStages.size])

  const filteredSets = useMemo(() => {
    return sets
      .filter(s => s.day === selectedDay)
      .filter(s => s.stage_id && selectedStages.has(s.stage_id))
      .sort((a, b) => {
        if (!a.start_time || !b.start_time) return 0
        return a.start_time.localeCompare(b.start_time) || (a.stages?.sort_order ?? 0) - (b.stages?.sort_order ?? 0)
      })
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
        <div className="text-text-secondary font-mono text-sm tracking-wider animate-pulse">LOADING...</div>
      </div>
    )
  }

  // Lineup-only mode for festivals without timetable
  if (!festival.timetable_announced) {
    return (
      <div className="pt-4">
        <h1 className="font-mono font-bold text-lg text-acid tracking-tight mb-1">{festival.name}</h1>
        <p className="text-text-secondary text-sm mb-4">{festival.location}</p>
        {days.length > 0 && (
          <DayToggle days={days} selectedDay={selectedDay} onSelect={setSelectedDay} />
        )}
        <LineupView
          sets={sets}
          day={selectedDay}
          isGoing={(id) => isGoing(id)}
          onToggleGoing={(id) => toggleGoing(id)}
        />
      </div>
    )
  }

  return (
    <div className="pt-4">
      <DayToggle days={days} selectedDay={selectedDay} onSelect={setSelectedDay} />
      <StageFilter
        stages={stages}
        selected={selectedStages}
        onToggle={handleToggleStage}
        onSelectAll={handleSelectAll}
      />

      <div className="space-y-2 mt-2">
        {filteredSets.map(set => {
          const playing = set.start_time && set.end_time
            ? isNowPlaying(now, set.day, set.start_time, set.end_time)
            : false
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
