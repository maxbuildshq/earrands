import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import posthog from 'posthog-js'
import type { SetWithStage, Stage } from '../../../types/database'
import { getDayBounds, getHourTicks, hasValidTime, minutesToLabel, packLane, timeToMinutes } from '../../../lib/timetable'
import { isNowPlaying } from '../../../hooks/useNowPlaying'
import { useRevealTooltip } from '../../../hooks/useRevealTooltip'
import { BottomSheet } from '../../common/BottomSheet'
import { AuthPrompt } from '../../common/AuthPrompt'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { TimetableSetBlock } from './TimetableSetBlock'
import { NowCursor } from './NowCursor'

const RULER_H = 30
const LABEL_W = 88
const BASE_LANE_H = 72 // single-programme lane
const ROW_H = 36 // per concurrent sub-row when a lane has overlap
const LANE_GAP = 4 // vertical gap between stage lanes
const MIN_PX = 0.8
const MAX_PX = 6

const clamp = (v: number) => Math.min(MAX_PX, Math.max(MIN_PX, v))

type Props = {
  sets: SetWithStage[]
  stages: Stage[]
  now: Date
  selectedDay: string
  currentDay: string | undefined
  user: boolean
  isGoing: (id: string) => boolean
  getRating: (id: string) => -1 | 1 | null
  conflictIds: Set<string>
  onToggleGoing: (id: string) => void
  onRate: (id: string, value: -1 | 1) => void
  onOpenSheet: (set: SetWithStage) => void
  onOpenStages?: () => void
  stageCount?: number
  totalStages?: number
}

function amsterdamHM(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

export function TimetableGrid({
  sets, stages, now, selectedDay, currentDay, user, isGoing, getRating, conflictIds, onToggleGoing, onRate, onOpenSheet,
  onOpenStages, stageCount, totalStages,
}: Props) {
  const [pxPerMin, setPxPerMin] = useState(2)
  const [authOpen, setAuthOpen] = useState(false)
  const { revealedId, reveal } = useRevealTooltip()
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinch = useRef<{ dist: number; px: number } | null>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  // Focal point to keep stable across a zoom (so the grid zooms under the cursor / pinch centre).
  const zoomAnchor = useRef<{ contentX: number; offset: number; oldPx: number } | null>(null)

  const laneIndex = useMemo(() => new Set(stages.map(s => s.id)), [stages])

  const visibleSets = useMemo(
    () => sets.filter(s => s.stage_id != null && laneIndex.has(s.stage_id)),
    [sets, laneIndex],
  )
  const timedSets = useMemo(() => visibleSets.filter(hasValidTime), [visibleSets])
  const untimedCount = visibleSets.length - timedSets.length

  const bounds = useMemo(() => getDayBounds(timedSets), [timedSets])

  // Pack each stage lane (overlapping sets → sub-rows) and size lanes to fit their concurrency.
  const { laneRows, laneLayout, lanesHeight } = useMemo(() => {
    const byStage = new Map<string, SetWithStage[]>()
    for (const s of timedSets) {
      const arr = byStage.get(s.stage_id!)
      if (arr) arr.push(s)
      else byStage.set(s.stage_id!, [s])
    }
    const rows = new Map<string, { row: number; rows: number }>()
    const maxRows = new Map<string, number>()
    byStage.forEach((arr, stageId) => {
      let mx = 1
      packLane(arr).forEach((v, k) => { rows.set(k, v); if (v.rows > mx) mx = v.rows })
      maxRows.set(stageId, mx)
    })
    const layout = new Map<string, { top: number; height: number; maxRows: number }>()
    let top = 0
    for (let i = 0; i < stages.length; i++) {
      const st = stages[i]
      const mx = maxRows.get(st.id) ?? 1
      const height = mx <= 1 ? BASE_LANE_H : mx * ROW_H
      layout.set(st.id, { top, height, maxRows: mx })
      top += height + LANE_GAP
    }
    return { laneRows: rows, laneLayout: layout, lanesHeight: top }
  }, [timedSets, stages])

  const isToday = selectedDay === currentDay
  const nowMin = isToday ? timeToMinutes(amsterdamHM(now)) : null
  const dayIsPast = currentDay ? selectedDay < currentDay : false

  const W = bounds ? (bounds.endMin - bounds.startMin) * pxPerMin : 0
  const nowLeft = bounds && nowMin != null && nowMin >= bounds.startMin && nowMin <= bounds.endMin
    ? (nowMin - bounds.startMin) * pxPerMin
    : null

  // Auto-scroll to the now-cursor (or start) when the day changes.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !bounds) return
    el.scrollLeft = nowLeft != null ? Math.max(0, nowLeft - 100) : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, bounds != null])

  // Keep the zoom focal point under the cursor/pinch centre after the width changes.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const a = zoomAnchor.current
    if (!el || !a) return
    el.scrollLeft = a.contentX * (pxPerMin / a.oldPx) - a.offset
    zoomAnchor.current = null
  }, [pxPerMin])

  // Report zoom level once it settles (debounced) — avoids an event per gesture step.
  const zoomReported = useRef(false)
  useEffect(() => {
    if (!zoomReported.current) { zoomReported.current = true; return }
    const t = setTimeout(() => posthog.capture('timetable_zoomed', { scale: Math.round(pxPerMin * 100) / 100 }), 700)
    return () => clearTimeout(t)
  }, [pxPerMin])

  function handleToggle(id: string) {
    if (!user) { setAuthOpen(true); return }
    onToggleGoing(id)
  }

  function handleRate(id: string, value: -1 | 1) {
    if (!user) { setAuthOpen(true); return }
    onRate(id, value)
  }

  function setAnchor(focalClientX: number) {
    const el = scrollRef.current
    if (!el) return
    const offset = focalClientX - el.getBoundingClientRect().left
    zoomAnchor.current = { contentX: el.scrollLeft + offset, offset, oldPx: pxPerMin }
  }

  // Pinch-to-zoom on the time axis, anchored to the pinch centre.
  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (!pinch.current) { pinch.current = { dist, px: pxPerMin }; return }
      setAnchor((a.x + b.x) / 2)
      setPxPerMin(clamp(pinch.current.px * (dist / pinch.current.dist)))
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return
    e.preventDefault()
    setAnchor(e.clientX)
    setPxPerMin(p => clamp(p * (e.deltaY < 0 ? 1.1 : 0.9)))
  }

  if (!bounds) {
    return (
      <div className="text-center py-12 text-text-secondary font-mono text-sm">
        {untimedCount > 0
          ? `Times not announced yet for ${untimedCount} set${untimedCount > 1 ? 's' : ''}. Switch to List to browse them.`
          : 'No sets found for this selection.'}
      </div>
    )
  }

  return (
    <>
      <div className="relative">
      <div className="flex border-t border-lane-line select-none">
        <div className="shrink-0 bg-surface" style={{ width: LABEL_W }}>
          {onOpenStages ? (
            <Button
              variant="segment"
              fullWidth={false}
              onClick={onOpenStages}
              title="Stages"
              aria-label="Stages"
              style={{ height: RULER_H }}
              className="w-full border-b border-lane-line flex items-center gap-1 px-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              {stageCount}/{totalStages}
            </Button>
          ) : (
            <div style={{ height: RULER_H }} className="border-b border-lane-line" />
          )}
          {stages.map((stage, i) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => reveal(stage.id)}
              className="relative border-b border-lane-line flex items-center px-2 w-full text-left"
              style={{ height: laneLayout.get(stage.id)?.height ?? BASE_LANE_H, marginBottom: i < stages.length - 1 ? LANE_GAP : 0 }}
            >
              <span className="font-mono font-bold text-sm uppercase text-text-secondary leading-tight line-clamp-2 break-words">
                {stage.name}
              </span>
              {revealedId === stage.id && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 z-40 px-2 py-1 bg-surface-raised border border-border font-mono font-bold text-xs uppercase text-text-primary whitespace-nowrap shadow-lg">
                  {stage.name}
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          ref={scrollRef}
          data-swipe-back="exclude"
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <div className="relative border-b border-lane-line" style={{ width: W, height: RULER_H }}>
            {getHourTicks(bounds).map(t => {
              const left = (t - bounds.startMin) * pxPerMin
              if (left > W) return null
              return (
                <div key={t} className="absolute top-0 h-full flex items-center pl-1 font-mono text-sm text-text-secondary/70 border-l border-grid-line" style={{ left }}>
                  {minutesToLabel(t)}
                </div>
              )
            })}
            {nowLeft != null && (
              <Badge variant="accent" className="absolute top-1 -translate-x-1/2 rounded-[3px] z-30" style={{ left: nowLeft }}>
                NOW {amsterdamHM(now)}
              </Badge>
            )}
          </div>

          <div className="relative" style={{ width: W, height: lanesHeight }}>
            {stages.map(stage => {
              const ll = laneLayout.get(stage.id)
              return ll && ll.top > 0
                ? <div key={stage.id} className="absolute left-0 border-t border-lane-line" style={{ top: ll.top, width: W }} />
                : null
            })}
            {getHourTicks(bounds).map(t => {
              const left = (t - bounds.startMin) * pxPerMin
              if (left <= 0 || left > W) return null
              return <div key={t} className="absolute top-0 w-px bg-grid-line" style={{ left, height: lanesHeight }} />
            })}

            {timedSets.map(set => {
              const ll = laneLayout.get(set.stage_id!)!
              const pack = laneRows.get(set.id) ?? { row: 0, rows: 1 }
              const subH = ll.height / ll.maxRows
              const playing = isToday && !!set.start_time && !!set.end_time && isNowPlaying(now, set.day, set.start_time, set.end_time)
              const past = dayIsPast || (isToday && nowMin != null && !!set.end_time && timeToMinutes(set.end_time) <= nowMin)
              const endsInMin = playing && nowMin != null && set.end_time ? timeToMinutes(set.end_time) - nowMin : null
              return (
                <TimetableSetBlock
                  key={set.id}
                  set={set}
                  bounds={bounds}
                  pxPerMin={pxPerMin}
                  top={ll.top + pack.row * subH + 1}
                  height={subH - 2}
                  isNow={playing}
                  isGoing={user && isGoing(set.id)}
                  rating={user ? getRating(set.id) : null}
                  isConflict={conflictIds.has(set.id)}
                  isPast={!!past}
                  endsInMin={endsInMin}
                  onToggleGoing={() => handleToggle(set.id)}
                  onRate={(v) => handleRate(set.id, v)}
                  onOpenSheet={() => onOpenSheet(set)}
                  revealed={revealedId === set.id}
                  onReveal={() => reveal(set.id)}
                />
              )
            })}

            {nowLeft != null && <NowCursor left={nowLeft} height={lanesHeight} />}
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-20 bg-surface/80 backdrop-blur-sm rounded p-1">
        <Button
          variant="icon"
          fullWidth={false}
          onClick={() => { setAnchor(scrollRef.current ? scrollRef.current.getBoundingClientRect().left + scrollRef.current.clientWidth / 2 : 0); setPxPerMin(p => clamp(p * 1.3)) }}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </Button>
        <Button
          variant="icon"
          fullWidth={false}
          onClick={() => { setAnchor(scrollRef.current ? scrollRef.current.getBoundingClientRect().left + scrollRef.current.clientWidth / 2 : 0); setPxPerMin(p => clamp(p * 0.7)) }}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </Button>
      </div>
      </div>

      {untimedCount > 0 && (
        <p className="text-text-secondary/70 font-mono text-sm mt-2 px-1">
          + {untimedCount} set{untimedCount > 1 ? 's' : ''} with no set time yet — switch to List to see {untimedCount > 1 ? 'them' : 'it'}.
        </p>
      )}

      {authOpen && (
        <BottomSheet title="SIGN UP TO SAVE" onClose={() => setAuthOpen(false)}>
          <AuthPrompt message="Create an account to mark sets you're going to and rate them." />
        </BottomSheet>
      )}
    </>
  )
}
