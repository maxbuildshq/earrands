import type { SetWithStage } from '../../types/database'
import { useAuth } from '../../hooks/useAuth'
import { GoingToggle } from '../actions/GoingToggle'
import { RatingButtons } from '../actions/RatingButtons'

type Props = {
  set: SetWithStage
  isNow: boolean
  isGoing: boolean
  rating: -1 | 1 | null
  onToggleGoing: () => void
  onRate: (value: -1 | 1) => void
  showConflict?: boolean
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

export function SetCard({ set, isNow, isGoing, rating, onToggleGoing, onRate, showConflict }: Props) {
  const { user } = useAuth()

  return (
    <div
      className={`relative bg-surface-raised border p-3 transition-colors ${
        isNow ? 'border-acid/50' : 'border-border'
      } ${showConflict ? 'border-conflict/60' : ''}`}
    >
      {isNow && (
        <div className="absolute top-0 left-0 w-1 h-full bg-acid animate-pulse" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className={`font-mono font-bold text-base truncate ${isNow ? 'text-acid' : 'text-text-primary'}`}>
              {set.artist_name}
            </h3>
            {set.is_live && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-live text-white uppercase leading-none">
                Live
              </span>
            )}
            {isNow && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-acid text-surface uppercase leading-none">
                Now
              </span>
            )}
            {showConflict && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-conflict text-surface uppercase leading-none">
                Conflict
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>{formatTime(set.start_time)} – {formatTime(set.end_time)}</span>
            <span className="text-border">·</span>
            <span>{set.stages.name}</span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-1 shrink-0">
            <GoingToggle isGoing={isGoing} onToggle={onToggleGoing} />
            <RatingButtons rating={rating} onRate={onRate} />
          </div>
        )}
      </div>
    </div>
  )
}
