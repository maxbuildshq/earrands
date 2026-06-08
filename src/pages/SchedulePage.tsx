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
import { SetSheet } from '../components/schedule/SetSheet'
import { LineupView } from '../components/schedule/LineupView'
import { getDays, toSortableTime, isAfterMidnight, getCurrentFestivalDay } from '../lib/dates'
import type { SetWithStage } from '../types/database'

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
  const [sheetSet, setSheetSet] = useState<SetWithStage | null>(null)
  const nowRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  // Set initial day: prefer current festival day, fall back to first day
  useEffect(() => {
    if (days.length > 0 && !selectedDay) {
      setSelectedDay(getCurrentFestivalDay(days, now) ?? days[0])
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
        return toSortableTime(a.start_time).localeCompare(toSortableTime(b.start_time)) || (a.stages?.sort_order ?? 0) - (b.stages?.sort_order ?? 0)
      })
  }, [sets, selectedDay, selectedStages])

  const nowScrollIndex = useMemo(() => {
    const firstNowIdx = filteredSets.findIndex(s =>
      s.start_time && s.end_time && isNowPlaying(now, s.day, s.start_time, s.end_time)
    )
    if (firstNowIdx <= 0) return firstNowIdx
    return firstNowIdx - 1
  }, [filteredSets, now])

  useEffect(() => {
    if (!hasScrolled.current && nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
          festival={festival}
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
      <div className="flex items-center justify-between gap-2 mb-3">
        <h1 className="font-mono font-bold text-lg text-acid tracking-tight truncate">
          {festival.name}
        </h1>
        {festival.location && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(festival.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 shrink-0 text-text-secondary hover:text-acid transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-sm font-mono truncate max-w-[160px]">{festival.location}</span>
          </a>
        )}
      </div>
      <DayToggle days={days} selectedDay={selectedDay} onSelect={setSelectedDay} />
      <StageFilter
        stages={stages}
        selected={selectedStages}
        onToggle={handleToggleStage}
        onSelectAll={handleSelectAll}
      />

      <div className="space-y-2 mt-2">
        {filteredSets.map((set, idx) => {
          const playing = set.start_time && set.end_time
            ? isNowPlaying(now, set.day, set.start_time, set.end_time)
            : false
          const prev = idx > 0 ? filteredSets[idx - 1] : null
          const showDivider = set.start_time && isAfterMidnight(set.start_time)
            && prev?.start_time && !isAfterMidnight(prev.start_time)
          return (
            <div key={set.id}>
              {showDivider && (
                <div className="flex items-center gap-3 py-3 mt-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="font-mono text-xs tracking-widest text-text-secondary">AFTER MIDNIGHT</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div ref={idx === nowScrollIndex ? nowRef : undefined}>
                <SetCard
                  set={set}
                  isNow={playing}
                  isGoing={user ? isGoing(set.id) : false}
                  rating={user ? getRating(set.id) : null}
                  onToggleGoing={() => toggleGoing(set.id)}
                  onRate={(v) => setRating(set.id, v)}
                  onOpenSheet={() => setSheetSet(set)}
                />
              </div>
            </div>
          )
        })}

        {filteredSets.length === 0 && (
          <div className="text-center py-12 text-text-secondary font-mono text-sm">
            No sets found for this selection.
          </div>
        )}
      </div>

      {sheetSet && (
        <SetSheet
          set={sheetSet}
          isGoing={user ? isGoing(sheetSet.id) : false}
          rating={user ? getRating(sheetSet.id) : null}
          onToggleGoing={() => toggleGoing(sheetSet.id)}
          onRate={(v) => setRating(sheetSet.id, v)}
          onClose={() => setSheetSet(null)}
        />
      )}
    </div>
  )
}
