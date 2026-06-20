import { useEffect, useRef } from 'react'
import { formatDayChip } from '../../lib/dates'
import { Button } from '../ui/Button'

type Props = {
  days: string[]
  selectedDay: string
  onSelect: (day: string) => void
}

export function DayToggle({ days, selectedDay, onSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null)

  // Keep the selected day visible in the horizontally-scrollable strip (handles 7+ days).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [selectedDay])

  return (
    <div data-swipe-back="exclude" className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex border border-border w-max">
        {days.map((day, i) => {
          const active = day === selectedDay
          return (
            <Button
              key={day}
              ref={active ? activeRef : undefined}
              variant="segment"
              active={active}
              fullWidth={false}
              onClick={() => onSelect(day)}
              className={`shrink-0 px-3.5 py-2.5 whitespace-nowrap ${i > 0 ? 'border-l border-border' : ''}`}
            >
              {formatDayChip(day)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
