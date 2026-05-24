import type { FestivalSet } from '../../types/database'
import { useAuth } from '../../hooks/useAuth'
import { GoingToggle } from '../actions/GoingToggle'

type Props = {
  sets: FestivalSet[]
  day: string
  isGoing: (id: string) => boolean
  onToggleGoing: (id: string) => void
}

export function LineupView({ sets, day, isGoing, onToggleGoing }: Props) {
  const { user } = useAuth()

  const daySets = sets
    .filter(s => s.day === day)
    .sort((a, b) => a.artist_name.localeCompare(b.artist_name))

  return (
    <div className="space-y-1 mt-3">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">
          {daySets.length} artists
        </span>
        <span className="font-mono text-xs text-acid/70 uppercase tracking-wider">
          Timetable TBA
        </span>
      </div>

      {daySets.map(set => (
        <div
          key={set.id}
          className="flex items-center justify-between bg-surface-raised border border-border p-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-bold text-sm text-text-primary truncate">
              {set.artist_name}
            </span>
            {set.is_live && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-live text-white uppercase leading-none">
                Live
              </span>
            )}
          </div>

          {user && (
            <div className="shrink-0 ml-2">
              <GoingToggle isGoing={isGoing(set.id)} onToggle={() => onToggleGoing(set.id)} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
