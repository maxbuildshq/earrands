import { useState } from 'react'
import type { SetWithStage, SetArtistWithBio } from '../../types/database'
import { SetActions } from '../actions/SetActions'
import { Badge } from '../ui/Badge'
import { Heading } from '../ui/Heading'

type Props = {
  set: SetWithStage
  isNow: boolean
  isGoing: boolean
  rating: -1 | 1 | null
  onToggleGoing: () => void
  onRate: (value: -1 | 1) => void
  onOpenSheet: () => void
  showConflict?: boolean
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

function getLeadImage(artists: SetArtistWithBio[] | null): string | null {
  if (!artists || artists.length === 0) return null
  const sorted = [...artists].sort((a, b) => a.billing_order - b.billing_order)
  return sorted[0].artists.image_url
}

export function SetCard({ set, isNow, isGoing, rating, onToggleGoing, onRate, onOpenSheet, showConflict }: Props) {
  const [imgError, setImgError] = useState(false)
  const leadImage = getLeadImage(set.set_artists)

  return (
    <div
        role="button"
        tabIndex={0}
        onClick={onOpenSheet}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSheet() } }}
        className="relative bg-surface-raised border border-border p-3 transition-colors cursor-pointer hover:bg-surface-hover"
        style={{
          ...(isNow ? { borderColor: 'var(--color-accent)', boxShadow: 'var(--shadow-now)' } : {}),
          ...(showConflict && !isNow ? { borderLeftColor: 'var(--color-conflict)', borderLeftWidth: 3 } : {}),
        }}
      >
        {isNow && (
          <div className="absolute top-0 left-0 w-1.5 h-full bg-accent animate-pulse" />
        )}
        {showConflict && !isNow && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ background: 'repeating-linear-gradient(135deg, var(--color-conflict) 0 7px, var(--color-surface) 7px 14px)' }}
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              {leadImage && !imgError && (
                <img
                  src={leadImage}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              )}
              <Heading variant="card" className={`truncate ${isNow ? 'text-accent' : ''}`}>
                {set.artist_name}
              </Heading>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              {set.start_time && set.end_time && (
                <span>{formatTime(set.start_time)} – {formatTime(set.end_time)}</span>
              )}
              {set.stages && set.start_time && (
                <span className="text-border">·</span>
              )}
              {set.stages && (
                <span>{set.stages.name}</span>
              )}
              {set.is_live && (
                <>
                  <span className="text-border">·</span>
                  <Badge variant="live" className="text-white">Live</Badge>
                </>
              )}
              {showConflict && !isNow && (
                <>
                  <span className="text-border">·</span>
                  <Badge variant="conflict">Clash</Badge>
                </>
              )}
            </div>
          </div>

          <SetActions isGoing={isGoing} rating={rating} onToggleGoing={onToggleGoing} onRate={onRate} />
        </div>
      </div>
  )
}
