import { formatDayLabel } from '../../lib/dates'

type Props = {
  days: string[]
  selectedDay: string
  onSelect: (day: string) => void
}

export function DayToggle({ days, selectedDay, onSelect }: Props) {
  return (
    <div className="flex border border-border">
      {days.map(day => (
        <button
          key={day}
          onClick={() => onSelect(day)}
          className={`flex-1 py-2.5 text-sm font-mono font-bold uppercase tracking-wider transition-colors ${
            day === selectedDay
              ? 'bg-acid text-surface'
              : 'bg-surface-raised text-text-secondary hover:text-text-primary'
          }`}
        >
          {formatDayLabel(day)}
        </button>
      ))}
    </div>
  )
}
