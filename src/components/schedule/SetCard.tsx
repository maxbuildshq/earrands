import { useState } from 'react'
import type { SetWithStage, SetArtistWithBio } from '../../types/database'
import { useAuth } from '../../hooks/useAuth'
import { GoingToggle } from '../actions/GoingToggle'
import { RatingButtons } from '../actions/RatingButtons'
import { BottomSheet } from '../common/BottomSheet'
import { AuthPrompt } from '../common/AuthPrompt'

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
  const { user } = useAuth()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const leadImage = getLeadImage(set.set_artists)

  const handleToggleGoing = () => {
    if (!user) { setAuthPromptOpen(true); return }
    onToggleGoing()
  }
  const handleRate = (value: -1 | 1) => {
    if (!user) { setAuthPromptOpen(true); return }
    onRate(value)
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenSheet}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSheet() } }}
        className={`relative bg-surface-raised border p-3 transition-colors cursor-pointer hover:bg-surface-hover ${
          isNow ? 'border-acid shadow-[0_0_20px_rgba(204,255,0,0.4),0_0_40px_rgba(204,255,0,0.15)]' : 'border-border'
        } ${showConflict ? 'border-conflict' : ''}`}
      >
        {isNow && (
          <div className="absolute top-0 left-0 w-1.5 h-full bg-acid animate-pulse" />
        )}
        {showConflict && !isNow && (
          <div className="absolute top-0 left-0 w-1 h-full bg-conflict" />
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
              <h3 className={`font-mono font-bold text-base truncate ${isNow ? 'text-acid' : 'text-text-primary'}`}>
                {set.artist_name}
              </h3>
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
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-live text-white uppercase leading-none">
                    Live
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <GoingToggle isGoing={isGoing} onToggle={handleToggleGoing} />
            <RatingButtons rating={rating} onRate={handleRate} />
          </div>
        </div>
      </div>

      {authPromptOpen && (
        <BottomSheet title="SIGN UP TO SAVE" onClose={() => setAuthPromptOpen(false)}>
          <AuthPrompt message="Create an account to mark sets you're going to and rate them." />
        </BottomSheet>
      )}
    </>
  )
}
