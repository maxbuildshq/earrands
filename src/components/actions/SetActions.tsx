import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { BottomSheet } from '../common/BottomSheet'
import { AuthPrompt } from '../common/AuthPrompt'
import { Button } from '../ui/Button'

type Props = {
  isGoing: boolean
  rating: -1 | 1 | null
  onToggleGoing: () => void
  onRate: (value: -1 | 1) => void
  showRating?: boolean
}

/*
 * Inline going + rating control, reused by SetCard and SetSheet. The going toggle's own active
 * state IS the "going" indicator — there is no separate badge.
 *
 * Auth gating is centralised here: an anonymous tap opens the sign-up prompt instead of mutating.
 * The whole control stops click propagation so it never opens the parent SetSheet.
 *
 * RESERVED — second interest tier: a future "must-see" tier slots in as another segment at the
 * start of this row, beside the going toggle. The row is `shrink-0` and parents give the title
 * `flex-1 min-w-0 truncate`, so the extra segment is absorbed by truncation without reflowing
 * surrounding content. Adding the tier needs no layout change in the consumers.
 */
export function SetActions({ isGoing, rating, onToggleGoing, onRate, showRating = true }: Props) {
  const { user } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const gated = (fn: () => void) => () => { if (!user) { setAuthOpen(true); return } fn() }

  return (
    <div className="flex items-center shrink-0 gap-px" onClick={e => e.stopPropagation()}>
      <Button
        variant="icon-toggle"
        active={isGoing}
        onClick={gated(onToggleGoing)}
        title={isGoing ? 'Remove from my sets' : 'Add to my sets'}
        aria-pressed={isGoing}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          {isGoing ? <polyline points="2,7 6,11 12,3" /> : (<><line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" /></>)}
        </svg>
      </Button>
      {showRating && (
        <>
          <Button
            variant="icon-toggle"
            active={rating === 1}
            onClick={gated(() => onRate(1))}
            title="Worth it"
            aria-pressed={rating === 1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={rating === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M7 22V11L2 13V22H7ZM7 11L11 2H12C13.1 2 14 2.9 14 4V9H20C21.1 9 22 10.1 21.7 11.2L19.2 20.2C19 21 18.3 21.5 17.5 21.5H7" />
            </svg>
          </Button>
          <Button
            variant="danger"
            active={rating === -1}
            onClick={gated(() => onRate(-1))}
            title="Not for me"
            aria-pressed={rating === -1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={rating === -1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" style={{ transform: 'rotate(180deg)' }}>
              <path d="M7 22V11L2 13V22H7ZM7 11L11 2H12C13.1 2 14 2.9 14 4V9H20C21.1 9 22 10.1 21.7 11.2L19.2 20.2C19 21 18.3 21.5 17.5 21.5H7" />
            </svg>
          </Button>
        </>
      )}

      {authOpen && (
        <BottomSheet title="SIGN UP TO SAVE" onClose={() => setAuthOpen(false)}>
          <AuthPrompt message="Create an account to mark sets you're going to and rate them." />
        </BottomSheet>
      )}
    </div>
  )
}
