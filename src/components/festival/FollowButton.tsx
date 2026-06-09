import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFestivalFollows } from '../../hooks/useFestivalFollows'
import { BottomSheet } from '../common/BottomSheet'
import { AuthPrompt } from '../common/AuthPrompt'

type Props = {
  festivalId: string
  variant?: 'icon' | 'banner'
}

/**
 * "Notify me when the timetable drops" for lineup-only festivals.
 * Logged-in: toggles a follow. Anonymous: opens a sign-up prompt (the conversion moment).
 */
export function FollowButton({ festivalId, variant = 'icon' }: Props) {
  const { user } = useAuth()
  const { isFollowing, toggleFollow } = useFestivalFollows()
  const [promptOpen, setPromptOpen] = useState(false)

  const following = user ? isFollowing(festivalId) : false

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      setPromptOpen(true)
      return
    }
    toggleFollow(festivalId)
  }

  return (
    <>
      {variant === 'banner' ? (
        <button
          onClick={handleClick}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 font-mono font-bold text-sm uppercase tracking-wider transition-colors ${
            following
              ? 'bg-acid text-surface'
              : 'border border-acid text-acid hover:bg-acid hover:text-surface'
          }`}
        >
          <BellIcon filled={following} />
          {following ? "You'll be notified" : 'Notify me when the timetable drops'}
        </button>
      ) : (
        <button
          onClick={handleClick}
          title={following ? "You'll be notified when the timetable drops" : 'Notify me when the timetable drops'}
          aria-label="Notify me when the timetable drops"
          className={`w-8 h-8 flex items-center justify-center border transition-colors ${
            following
              ? 'bg-acid text-surface border-acid'
              : 'bg-surface text-text-secondary border-border hover:border-text-secondary'
          }`}
        >
          <BellIcon filled={following} />
        </button>
      )}

      {promptOpen && (
        <BottomSheet title="GET NOTIFIED" onClose={() => setPromptOpen(false)}>
          <AuthPrompt message="Create an account and we'll email you when the timetable drops." />
        </BottomSheet>
      )}
    </>
  )
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
      <path d="M7 1.5a3 3 0 0 0-3 3c0 3-1.5 4-1.5 4h9s-1.5-1-1.5-4a3 3 0 0 0-3-3Z" strokeLinejoin="round" />
      <path d="M5.5 11.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
    </svg>
  )
}
