import { useState, useEffect } from 'react'
import { isAfterMidnight } from '../lib/dates'

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
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
