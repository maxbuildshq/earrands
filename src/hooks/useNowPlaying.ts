import { useState, useEffect, useRef } from 'react'
import { isAfterMidnight } from '../lib/dates'

/** Dev-only time emulation: `?now=2026-07-30T23:30:00+02:00` anchors "now" so the
 *  timetable's now-cursor, live/past states and countdowns can be verified off-festival.
 *  Time still flows from the anchor. No param → real time. */
function getNowOffset(): number {
  if (typeof window === 'undefined') return 0
  const p = new URLSearchParams(window.location.search).get('now')
  if (!p) return 0
  const t = new Date(p).getTime()
  return Number.isNaN(t) ? 0 : t - Date.now()
}

export function useNow(intervalMs = 60_000) {
  const offset = useRef(getNowOffset())
  const [now, setNow] = useState(() => new Date(Date.now() + offset.current))

  useEffect(() => {
    const id = setInterval(() => setNow(new Date(Date.now() + offset.current)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}

// Festival times are Europe/Amsterdam. Combine day + time into a Date in that TZ.
// Times before 07:00 belong to the next calendar day (after-midnight sets stored under the previous festival day).
export function toFestivalDate(day: string, time: string): Date {
  const d = new Date(`${day}T${time}+02:00`)
  if (isAfterMidnight(time)) d.setDate(d.getDate() + 1)
  return d
}

export function isNowPlaying(now: Date, day: string, startTime: string, endTime: string): boolean {
  const start = toFestivalDate(day, startTime)
  const end = toFestivalDate(day, endTime)
  return now >= start && now < end
}
