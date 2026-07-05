import { useState } from 'react'
import type { SetWithStage, SetArtistWithBio } from '../../types/database'
import { SetActions } from '../actions/SetActions'
import { Badge } from '../ui/Badge'
import { Heading } from '../ui/Heading'
import { imageCrossOrigin } from '../../lib/images'

type Props = {
  set: SetWithStage
  isNow: boolean
  isGoing: boolean
  rating: -1 | 1 | null
  onToggleGoing: () => void
  onRate: (value: -1 | 1) => void
  onOpenSheet: () => void
  showConflict?: boolean
  revealed?: boolean
  onReveal?: () => void
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

function getLeadImage(artists: SetArtistWithBio[] | null): string | null {
  if (!artists || artists.length === 0) return null
  const sorted = [...artists].sort((a, b) => a.billing_order - b.billing_order)
  return sorted[0].artists.image_url
}

export function SetCard({ set, isNow, isGoing, rating, onToggleGoing, onRate, onOpenSheet, showConflict, revealed, onReveal }: Props) {
  const [imgError, setImgError] = useState(false)
  const leadImage = set.is_music_set ? getLeadImage(set.set_artists) : null
  const handleClick = () => { if (set.is_music_set) onOpenSheet(); else onReveal?.() }

  return (
    <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
        data-onboarding-target="set_sheet"
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
                  crossOrigin={imageCrossOrigin(leadImage)}
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              )}
              <Heading variant="card" className={`truncate ${isNow ? 'text-accent' : ''}`}>
                {set.artist_name}
              </Heading>
            </div>

            <div className="text-base text-text-secondary space-y-0.5">
              {set.start_time && set.end_time && (
                <div className="flex items-center gap-2">
                  <span>{formatTime(set.start_time)} – {formatTime(set.end_time)}</span>
                  {showConflict && !isNow && <Badge variant="conflict">Clash</Badge>}
                </div>
              )}
              {(set.stages || set.is_live) && (
                <div className="flex items-center gap-2">
                  {set.stages && <span>{set.stages.name}</span>}
                  {set.stages && set.is_live && <span className="text-border">·</span>}
                  {set.is_live && <Badge variant="live" className="text-white">Live</Badge>}
                </div>
              )}
            </div>
          </div>

          <SetActions isGoing={isGoing} rating={rating} onToggleGoing={onToggleGoing} onRate={onRate} showRating={set.is_music_set} />
        </div>

        {revealed && (
          <span className="absolute left-3 top-3 z-40 px-2 py-1 bg-surface border border-border font-mono font-bold text-xs uppercase text-text-primary shadow-lg max-w-[calc(100%-1.5rem)]">
            {set.artist_name}
          </span>
        )}
      </div>
  )
}
