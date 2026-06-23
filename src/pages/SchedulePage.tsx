import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import posthog from 'posthog-js'
import { useFestival, useStages, useSets } from '../hooks/useFestivalData'
import { useUserPlans } from '../hooks/useUserPlans'
import { useUserRatings } from '../hooks/useUserRatings'
import { useNow, isNowPlaying } from '../hooks/useNowPlaying'
import { useAuth } from '../hooks/useAuth'
import { useRevealTooltip } from '../hooks/useRevealTooltip'
import { DayToggle } from '../components/schedule/DayToggle'
import { StagesSheet } from '../components/schedule/StagesSheet'
import { SetCard } from '../components/schedule/SetCard'
import { SetSheet } from '../components/schedule/SetSheet'
import { LineupView } from '../components/schedule/LineupView'
import { TimetableGrid } from '../components/schedule/timetable/TimetableGrid'
import { ShareScheduleSheet } from '../components/festival/ShareScheduleSheet'
import { Button } from '../components/ui/Button'
import { Heading } from '../components/ui/Heading'
// Atmosphere (fog) temporarily disabled — perf. Component + CSS kept for later.
// import { Atmosphere } from '../components/common/Atmosphere'
import { getDays, toSortableTime, isAfterMidnight, getCurrentFestivalDay } from '../lib/dates'
import { findConflictIds, setsOverlap } from '../lib/conflicts'
import { orderVisibleStages } from '../lib/stages'
import { hasValidTime } from '../lib/timetable'
import type { SetWithStage } from '../types/database'

export function SchedulePage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const { data: festival } = useFestival(slug)
  const { data: stages = [] } = useStages(festival?.id)
  const { data: sets = [] } = useSets(festival?.id)
  const { planSetIds, isGoing, toggleGoing } = useUserPlans()
  const { getRating, setRating } = useUserRatings()
  const now = useNow()
  const { revealedId, reveal } = useRevealTooltip()

  const days = useMemo(() => festival ? getDays(festival.start_date, festival.end_date) : [], [festival])

  const [selectedDay, setSelectedDay] = useState<string>('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [pinned, setPinned] = useState<string[]>([])
  const [stagesOpen, setStagesOpen] = useState(false)
  const [sheetSet, setSheetSet] = useState<SetWithStage | null>(null)
  const [picksOnly, setPicksOnly] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const nowRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)
  const [layoutMode, setLayoutMode] = useState<'timetable' | 'list'>(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('layout-mode') === 'list' ? 'list' : 'timetable'),
  )
  const chooseLayout = (m: 'timetable' | 'list') => {
    setLayoutMode(m)
    try { localStorage.setItem('layout-mode', m) } catch { /* ignore */ }
    posthog.capture('timetable_layout_switched', { mode: m })
  }

  const choosePicks = (on: boolean) => {
    setPicksOnly(on)
    posthog.capture('picks_filter_toggled', { state: on ? 'picks' : 'all', count: mySets.length })
  }

  const openSheet = (set: SetWithStage) => {
    const clashCount = mySets.filter(s => s.id !== set.id && setsOverlap(s, set)).length
    if (clashCount > 0) posthog.capture('conflict_viewed', { set_id: set.id, clash_count: clashCount })
    setSheetSet(set)
  }

  // Set initial day: prefer current festival day, fall back to first day
  useEffect(() => {
    if (days.length > 0 && !selectedDay) {
      setSelectedDay(getCurrentFestivalDay(days, now) ?? days[0])
    }
  }, [days, selectedDay])

  // Load / persist stage prefs (hidden + pinned) per festival.
  useEffect(() => {
    if (!festival) return
    try {
      const raw = localStorage.getItem(`stage-prefs:${festival.id}`)
      const p = raw ? JSON.parse(raw) : {}
      setHidden(new Set<string>(p.hidden ?? []))
      setPinned(p.pinned ?? [])
    } catch { setHidden(new Set()); setPinned([]) }
  }, [festival?.id])

  useEffect(() => {
    if (!festival) return
    try { localStorage.setItem(`stage-prefs:${festival.id}`, JSON.stringify({ hidden: [...hidden], pinned })) } catch { /* ignore */ }
  }, [festival?.id, hidden, pinned])

  const conflictIds = useMemo(
    () => findConflictIds(sets.filter(s => planSetIds.has(s.id))),
    [sets, planSetIds],
  )
  const mySets = useMemo(
    () => sets.filter(s => planSetIds.has(s.id))
      .sort((a, b) => a.day.localeCompare(b.day) || (a.start_time ?? '').localeCompare(b.start_time ?? '')),
    [sets, planSetIds],
  )
  // Festival-scoped: planSetIds spans all festivals, so count this festival's sets only.
  const picksCount = mySets.length

  const filteredSets = useMemo(() => {
    return sets
      .filter(s => s.day === selectedDay)
      .filter(s => s.stage_id && !hidden.has(s.stage_id))
      .filter(s => !picksOnly || planSetIds.has(s.id))
      .sort((a, b) => {
        if (!a.start_time || !b.start_time) return 0
        return toSortableTime(a.start_time).localeCompare(toSortableTime(b.start_time)) || (a.stages?.sort_order ?? 0) - (b.stages?.sort_order ?? 0)
      })
  }, [sets, selectedDay, hidden, picksOnly, planSetIds])

  const currentDay = useMemo(() => getCurrentFestivalDay(days, now), [days, now])
  const daySets = useMemo(
    () => sets.filter(s => s.day === selectedDay && (!picksOnly || planSetIds.has(s.id))),
    [sets, selectedDay, picksOnly, planSetIds],
  )
  const visibleStages = useMemo(() => orderVisibleStages(stages, hidden, pinned), [stages, hidden, pinned])

  // Stages with at least one (timed, picks-respecting) set on the selected day — used to hide
  // empty lanes from the timetable. The full stage list (including empty-today ones) still
  // shows in StagesSheet so hide/pin prefs remain editable for other days.
  const stagesWithSetsToday = useMemo(
    () => new Set(daySets.filter(hasValidTime).map(s => s.stage_id)),
    [daySets],
  )
  const timetableStages = useMemo(
    () => visibleStages.filter(st => stagesWithSetsToday.has(st.id)),
    [visibleStages, stagesWithSetsToday],
  )

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

  const toggleHidden = (stageId: string) => {
    const next = new Set(hidden)
    if (next.has(stageId)) {
      next.delete(stageId)
    } else {
      // Don't hide the last visible stage.
      if (stages.filter(s => !next.has(s.id)).length <= 1) return
      next.add(stageId)
    }
    setHidden(next)
    posthog.capture('stage_filter_changed', { visible_count: stages.filter(s => !next.has(s.id)).length })
  }

  const togglePin = (stageId: string) => {
    const next = pinned.includes(stageId) ? pinned.filter(p => p !== stageId) : [...pinned, stageId]
    setPinned(next)
    posthog.capture('stage_pinned', { pinned: next.includes(stageId) })
  }

  const showAllStages = () => {
    setHidden(new Set())
    posthog.capture('stage_filter_changed', { visible_count: stages.length })
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

  const picksEmpty = picksOnly && picksCount === 0

  return (
    <div className="pt-4">
      {/* Control row: All/Picks group · Share · spacer · (list-mode Stages) · Timetable/List group */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex border border-border">
          <Button variant="segment" active={!picksOnly} fullWidth={false} onClick={() => choosePicks(false)} className="px-3 py-2">
            All
          </Button>
          <Button variant="segment" active={picksOnly} fullWidth={false} onClick={() => choosePicks(true)} className="px-3 py-2 border-l border-border">
            Picks ({picksCount})
          </Button>
        </div>

        {picksOnly && picksCount > 0 && (
          <Button
            variant="accent-outline"
            fullWidth={false}
            onClick={() => setShareOpen(true)}
            title="Share"
            aria-label="Share"
            className="shrink-0 !p-0 !px-2.5 !py-2 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M8 7l4-4 4 4" />
              <path d="M8 11H6.5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H16" />
            </svg>
          </Button>
        )}

        <div className="flex-1" />

        {layoutMode === 'list' && (
          <Button
            variant="icon"
            fullWidth={false}
            onClick={() => setStagesOpen(true)}
            title="Stages"
            aria-label="Stages"
            className="shrink-0 !w-auto !h-auto gap-1.5 px-3 py-2 font-mono font-bold text-xs uppercase tracking-wider"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            {visibleStages.length}/{stages.length}
          </Button>
        )}

        <div className="flex border border-border">
          {(['timetable', 'list'] as const).map((m, i) => (
            <Button
              key={m}
              variant="segment"
              active={layoutMode === m}
              fullWidth={false}
              onClick={() => chooseLayout(m)}
              title={m === 'timetable' ? 'Timetable' : 'List'}
              aria-label={m}
              className={`px-2.5 py-2 flex items-center justify-center ${i > 0 ? 'border-l border-border' : ''}`}
            >
              {m === 'timetable' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="7" rx="1" />
                  <rect x="3" y="13" width="18" height="7" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              )}
            </Button>
          ))}
        </div>
      </div>

      <DayToggle days={days} selectedDay={selectedDay} onSelect={setSelectedDay} />

      {picksEmpty ? (
        <div className="flex flex-col items-center gap-4 text-center py-16 text-text-secondary font-mono text-sm">
          {user ? (
            <p>No sets marked yet. Tap <span className="text-accent font-bold">+</span> on a set to build your picks.</p>
          ) : (
            <>
              <p>Sign up to save the sets you're going to.</p>
              <Link
                to="/signup"
                state={{ returnTo: `/festivals/${slug}/schedule` }}
                className="px-4 py-2 bg-accent text-surface font-bold uppercase tracking-wider hover:bg-accent-dim transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      ) : layoutMode === 'timetable' ? (
        <div className="mt-2">
          <TimetableGrid
            sets={daySets}
            stages={timetableStages}
            now={now}
            selectedDay={selectedDay}
            currentDay={currentDay}
            user={!!user}
            isGoing={isGoing}
            getRating={getRating}
            conflictIds={conflictIds}
            onToggleGoing={toggleGoing}
            onRate={(id, v) => setRating(id, v)}
            onOpenSheet={openSheet}
            onOpenStages={() => setStagesOpen(true)}
            stageCount={visibleStages.length}
            totalStages={stages.length}
          />
        </div>
      ) : (
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
                    <Heading variant="section" className="text-text-secondary">After midnight</Heading>
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
                    onOpenSheet={() => openSheet(set)}
                    showConflict={conflictIds.has(set.id)}
                    revealed={revealedId === set.id}
                    onReveal={() => reveal(set.id)}
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
      )}

      {sheetSet && (
        <SetSheet
          set={sheetSet}
          isGoing={user ? isGoing(sheetSet.id) : false}
          rating={user ? getRating(sheetSet.id) : null}
          onToggleGoing={() => toggleGoing(sheetSet.id)}
          onRate={(v) => setRating(sheetSet.id, v)}
          onClose={() => setSheetSet(null)}
          clashes={mySets.filter(s => s.id !== sheetSet.id && setsOverlap(s, sheetSet))}
        />
      )}

      {shareOpen && (
        <ShareScheduleSheet
          festivalName={festival.name}
          festivalId={festival.id}
          festivalSlug={festival.slug}
          sets={mySets}
          onClose={() => setShareOpen(false)}
        />
      )}

      {stagesOpen && (
        <StagesSheet
          stages={stages}
          hidden={hidden}
          pinned={pinned}
          stagesWithSetsToday={stagesWithSetsToday}
          onToggleHidden={toggleHidden}
          onTogglePin={togglePin}
          onShowAll={showAllStages}
          onClose={() => setStagesOpen(false)}
        />
      )}
    </div>
  )
}
