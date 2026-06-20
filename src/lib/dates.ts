export const AFTER_MIDNIGHT_CUTOFF = '07:00'

export function isAfterMidnight(time: string): boolean {
  return time < AFTER_MIDNIGHT_CUTOFF
}

export function toSortableTime(time: string): string {
  if (isAfterMidnight(time)) {
    const [h, m] = time.split(':')
    return `${String(parseInt(h) + 24).padStart(2, '0')}:${m}`
  }
  return time
}

/** Generate array of date strings (YYYY-MM-DD) between start and end inclusive */
export function getDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const current = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')

  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }

  return days
}

/** Return the festival day matching "now" in Europe/Amsterdam, accounting for the 07:00 cutoff. */
export function getCurrentFestivalDay(days: string[], now: Date = new Date()): string | undefined {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const year = parts.find(p => p.type === 'year')!.value
  const month = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  const hour = parts.find(p => p.type === 'hour')!.value
  const minute = parts.find(p => p.type === 'minute')!.value

  let calendarDate = `${year}-${month}-${day}`
  const timeStr = `${hour}:${minute}`

  if (timeStr < AFTER_MIDNIGHT_CUTOFF) {
    const d = new Date(`${calendarDate}T12:00:00`)
    d.setDate(d.getDate() - 1)
    calendarDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return days.includes(calendarDate) ? calendarDate : undefined
}

/** Format a date string to short display: "SAT 16 MAY" */
export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).toUpperCase()
}

/** Short scrollable-chip label: weekday + day number, e.g. "FRI 31". */
export function formatDayChip(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }).toUpperCase()
}

/** Festival date range for the header sub-line: "WED 29 JUL – SUN 2 AUG" (single date if start === end). */
export function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDayLabel(startDate)
  return `${formatDayLabel(startDate)} – ${formatDayLabel(endDate)}`
}
