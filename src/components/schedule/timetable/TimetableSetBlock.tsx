import { useState, type CSSProperties } from 'react'
import type { SetWithStage, SetArtistWithBio } from '../../../types/database'
import { Badge } from '../../ui/Badge'
import { setPosition, type DayBounds } from '../../../lib/timetable'

function getLeadImage(artists: SetArtistWithBio[] | null): string | null {
  if (!artists || artists.length === 0) return null
  const sorted = [...artists].sort((a, b) => a.billing_order - b.billing_order)
  return sorted[0].artists.image_url
}

type Props = {
  set: SetWithStage
  bounds: DayBounds
  pxPerMin: number
  top: number
  height: number
  isNow: boolean
  isGoing: boolean
  rating: -1 | 1 | null
  isConflict: boolean
  isPast: boolean
  endsInMin: number | null
  onToggleGoing: () => void
  onRate: (value: -1 | 1) => void
  onOpenSheet: () => void
}

const ACID = 'var(--color-accent)'
const CONFLICT = 'var(--color-conflict)'

export function TimetableSetBlock({
  set, bounds, pxPerMin, top, height,
  isNow, isGoing, rating, isConflict, isPast, endsInMin, onToggleGoing, onRate, onOpenSheet,
}: Props) {
  const [imgError, setImgError] = useState(false)
  const pos = setPosition(set, bounds, pxPerMin)
  if (!pos) return null

  const width = Math.max(pos.width - 3, 32)
  let bg = 'var(--color-surface-raised)'
  let borderColor = 'var(--color-border-subtle)'
  let borderLeftColor = 'var(--color-border-subtle)'

  if (isGoing) {
    bg = `color-mix(in srgb, ${ACID} 12%, var(--color-surface))`
    borderLeftColor = ACID
  }
  if (isConflict) {
    bg = `color-mix(in srgb, ${CONFLICT} 12%, var(--color-surface))`
    borderLeftColor = CONFLICT
  }
  if (isNow) {
    bg = `color-mix(in srgb, ${ACID} 17%, var(--color-surface))`
    borderColor = ACID
    borderLeftColor = ACID
  }

  const style: CSSProperties = {
    position: 'absolute',
    left: pos.left,
    top,
    width,
    height,
    background: bg,
    borderColor,
    borderLeftColor,
    borderLeftWidth: 3,
    opacity: isPast ? 0.4 : 1,
  }

  const showToggle = width > 80 && height >= 28
  const showRating = width > 120 && height >= 28
  const showTime = height >= 48 && width > 56
  const leadImage = getLeadImage(set.set_artists)
  const showImage = !imgError && !!leadImage && width > 110 && height >= 40

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenSheet}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSheet() } }}
      style={style}
      className={`absolute border rounded-[3px] px-2.5 overflow-hidden cursor-pointer ${isConflict ? 'pt-3 pb-1.5' : 'py-1.5'} ${isNow ? 'animate-pulse-glow' : ''}`}
    >
      {isConflict && (
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: `repeating-linear-gradient(135deg, ${CONFLICT} 0 7px, var(--color-surface) 7px 14px)` }}
        />
      )}

      <div className={`flex items-center gap-1.5 min-w-0 ${showRating ? 'pr-16' : showToggle ? 'pr-6' : ''}`}>
        {showImage && (
          <img
            src={leadImage!}
            alt=""
            className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
        <div className={`font-mono font-bold text-base truncate leading-tight min-w-0 ${isNow ? 'text-white' : 'text-text-primary'}`}>
          {set.artist_name}
        </div>
      </div>
      {showTime && set.start_time && set.end_time && (
        <div className="text-sm text-text-secondary/80 mt-0.5 truncate">
          {set.start_time.slice(0, 5)}–{set.end_time.slice(0, 5)}
        </div>
      )}
      {isNow && endsInMin != null && endsInMin > 0 && (
        <div className="font-mono text-[10px] font-bold mt-0.5 text-accent">
          ENDS IN {endsInMin} MIN
        </div>
      )}
      {isConflict && width > 70 && (
        <Badge variant="conflict" className="absolute bottom-1 right-1.5">Clash</Badge>
      )}

      {showToggle && (
        <div className={`absolute ${isConflict ? 'top-3' : 'top-1.5'} right-1.5 flex items-center gap-px`} onClick={e => e.stopPropagation()}>
          <button
            onClick={onToggleGoing}
            title={isGoing ? 'Remove from my sets' : 'Add to my sets'}
            className="w-5 h-5 flex items-center justify-center rounded-[3px] border"
            style={
              isGoing || isNow
                ? { background: ACID, borderColor: ACID, color: 'var(--color-surface)' }
                : { background: 'rgba(0,0,0,0.3)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-dim)' }
            }
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
              {isGoing ? <polyline points="2,7 6,11 12,3" /> : (<><line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" /></>)}
            </svg>
          </button>
          {showRating && (
            <>
              <button
                onClick={() => onRate(1)}
                title="Worth it"
                className="w-5 h-5 flex items-center justify-center rounded-[3px] border"
                style={
                  rating === 1
                    ? { background: ACID, borderColor: ACID, color: 'var(--color-surface)' }
                    : { background: 'rgba(0,0,0,0.3)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-dim)' }
                }
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill={rating === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M7 22V11L2 13V22H7ZM7 11L11 2H12C13.1 2 14 2.9 14 4V9H20C21.1 9 22 10.1 21.7 11.2L19.2 20.2C19 21 18.3 21.5 17.5 21.5H7" />
                </svg>
              </button>
              <button
                onClick={() => onRate(-1)}
                title="Not for me"
                className="w-5 h-5 flex items-center justify-center rounded-[3px] border"
                style={
                  rating === -1
                    ? { background: 'var(--color-negative)', borderColor: 'var(--color-negative)', color: 'var(--color-surface)' }
                    : { background: 'rgba(0,0,0,0.3)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-dim)' }
                }
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill={rating === -1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" style={{ transform: 'rotate(180deg)' }}>
                  <path d="M7 22V11L2 13V22H7ZM7 11L11 2H12C13.1 2 14 2.9 14 4V9H20C21.1 9 22 10.1 21.7 11.2L19.2 20.2C19 21 18.3 21.5 17.5 21.5H7" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
