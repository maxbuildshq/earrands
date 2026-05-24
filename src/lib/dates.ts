/** Generate array of date strings (YYYY-MM-DD) between start and end inclusive */
export function getDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  while (current <= end) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return days
}

/** Format a date string to short display: "SAT 16 MAY" */
export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).toUpperCase()
}
