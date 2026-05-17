import { useState, useEffect } from 'react'

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}

// Festival times are Europe/Amsterdam. Combine day + time into a Date in that TZ.
export function toFestivalDate(day: string, time: string): Date {
  return new Date(`${day}T${time}+02:00`)
}

export function isNowPlaying(now: Date, day: string, startTime: string, endTime: string): boolean {
  const start = toFestivalDate(day, startTime)
  const end = toFestivalDate(day, endTime)
  return now >= start && now < end
}
