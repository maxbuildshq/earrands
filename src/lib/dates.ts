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

/** Format a date string to short display: "SAT 16 MAY" */
export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).toUpperCase()
}
