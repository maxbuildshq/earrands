import { useEffect, useRef, useCallback } from 'react'
import type { SetWithStage } from '../../types/database'
import { useAuth } from '../../hooks/useAuth'
import { GoingToggle } from '../actions/GoingToggle'
import { RatingButtons } from '../actions/RatingButtons'

type Props = {
  set: SetWithStage
  isGoing: boolean
  rating: -1 | 1 | null
  onToggleGoing: () => void
  onRate: (value: -1 | 1) => void
  onClose: () => void
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

/**
 * Resolve bios for a set, handling:
 * 1. Individual bios only (Awakenings pattern)
 * 2. Combo bio only (Dekmantel duo)
 * 3. Combo bio + some individual bios (Dekmantel B2B with overlap)
 * 4. Partial data (some artists have bios, others don't)
 */
function resolveBios(set: SetWithStage) {
  const artists = set.set_artists ?? []
  const sorted = [...artists].sort((a, b) => a.billing_order - b.billing_order)

  // Check for a combo bio: an artist entry whose name matches the full set artist_name
  const comboBio = sorted.find(
    sa => sa.artists.name.toLowerCase() === set.artist_name.toLowerCase() && sa.artists.bio
  )

  // Individual artists (excluding the combo entry itself)
  const individuals = sorted.filter(
    sa => sa.artists.name.toLowerCase() !== set.artist_name.toLowerCase() && sa.artists.bio
  )

  // If we have a combo bio but no individuals, check if there's a single solo artist
  // whose name matches the set name (solo set)
  const isSolo = sorted.length === 1 && sorted[0].role === 'solo'

  if (isSolo && sorted[0].artists.bio) {
    return { comboBio: null, individuals: [{ name: sorted[0].artists.name, bio: sorted[0].artists.bio }] }
  }

  return {
    comboBio: comboBio?.artists.bio ?? null,
    individuals: individuals.map(sa => ({ name: sa.artists.name, bio: sa.artists.bio! })),
  }
}

export function SetSheet({ set, isGoing, rating, onToggleGoing, onRate, onClose }: Props) {
  const { user } = useAuth()
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const touchCurrentY = useRef(0)
  const isDragging = useRef(false)

  const { comboBio, individuals } = resolveBios(set)
  const hasBio = comboBio || individuals.length > 0

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Lock body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }, [onClose])

  // Swipe-to-dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    isDragging.current = false
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY
    const delta = touchCurrentY.current - touchStartY.current
    if (delta > 0) {
      isDragging.current = true
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${delta}px)`
        sheetRef.current.style.transition = 'none'
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const delta = touchCurrentY.current - touchStartY.current
    if (sheetRef.current) {
      sheetRef.current.style.transition = ''
      sheetRef.current.style.transform = ''
    }
    if (isDragging.current && delta > 100) {
      onClose()
    }
    isDragging.current = false
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/60 animate-fade-in"
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-surface-raised border-t border-border animate-slide-up overflow-hidden flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header: set details + close button */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-mono font-bold text-lg text-text-primary leading-tight">
                {set.artist_name}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
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

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors shrink-0"
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="2" y1="2" x2="12" y2="12" />
                <line x1="12" y1="2" x2="2" y2="12" />
              </svg>
            </button>
          </div>

          {/* Action buttons right after set details */}
          {user && (
            <div className="flex items-center gap-1 mt-3">
              <GoingToggle isGoing={isGoing} onToggle={onToggleGoing} />
              <RatingButtons rating={rating} onRate={onRate} />
            </div>
          )}
        </div>

        {/* Divider */}
        {hasBio && <div className="h-px bg-border mx-4 shrink-0" />}

        {/* Scrollable bio content */}
        {hasBio && (
          <div className="overflow-y-auto px-4 py-3 flex-1 min-h-0">
            {/* Combo bio (describes the specific set/collaboration) */}
            {comboBio && (
              <div className="mb-4">
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                  {comboBio}
                </p>
              </div>
            )}

            {/* Individual artist bios */}
            {individuals.map((artist, idx) => (
              <div key={artist.name} className={idx > 0 || comboBio ? 'mt-4' : ''}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-mono text-xs tracking-widest text-text-secondary uppercase">
                    {artist.name}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                  {artist.bio}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
