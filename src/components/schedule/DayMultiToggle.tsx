import { useEffect, useRef } from 'react'
import { formatDayChip } from '../../lib/dates'
import { Button } from '../ui/Button'

type Props = {
  days: string[]
  selectedDays: Set<string>
  onToggle: (day: string) => void
}

export function DayMultiToggle({ days, selectedDays, onToggle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [selectedDays])

  return (
    <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex border border-border w-max">
        {days.map((day, i) => {
          const active = selectedDays.has(day)
          return (
            <Button
              key={day}
              data-active={active}
              variant="segment"
              active={active}
              fullWidth={false}
              onClick={() => onToggle(day)}
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
