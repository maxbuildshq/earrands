import { useEffect, useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { getSeenHints, markHintSeen, nextHint, type HintId } from '../../lib/onboarding'

// Session (page-load) cadence state — survives route changes, resets on reload.
let shownThisSession = 0
const captured = new Set<HintId>()

const PlusIcon = (
  <span className="inline-flex w-5 h-5 border border-border text-text-secondary items-center justify-center align-[-4px] mx-0.5" aria-hidden>
    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" />
    </svg>
  </span>
)

// Mini-mocks are drawn with the app's own tokens/CSS — no image assets (docs/onboarding-strategy.md).
export function ClashMock() {
  return (
    <div className="w-16 shrink-0 space-y-1" aria-hidden>
      {[false, true].map((clash, i) => (
        <div
          key={i}
          className="h-5 border border-border flex"
          style={clash ? { borderLeftColor: 'var(--color-conflict)', borderLeftWidth: 3, marginLeft: 8 } : undefined}
        >
          {clash && (
            <div
              className="w-2 ml-auto"
              style={{ background: 'repeating-linear-gradient(135deg, var(--color-conflict) 0 4px, var(--color-surface) 4px 8px)' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function PosterMock() {
  return (
    <div className="w-9 h-16 shrink-0 border border-border p-1 flex flex-col gap-1" aria-hidden>
      <div className="h-2 bg-accent" />
      <div className="h-1 bg-text-secondary/60 w-4/5" />
      <div className="h-1 bg-text-secondary/60" />
      <div className="h-1 bg-text-secondary/60 w-3/5" />
    </div>
  )
}

// Non-interactive replicas of SetSheet's social buttons (Instagram, SoundCloud) — see resolveArtists/SocialLinks in SetSheet.tsx.
function SocialIconsMock() {
  return (
    <div className="flex items-center gap-1.5 shrink-0" aria-hidden>
      <div className="w-8 h-8 flex items-center justify-center border border-border text-text-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div className="w-8 h-8 flex items-center justify-center border border-border text-text-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
        </svg>
      </div>
    </div>
  )
}

// Non-interactive replica of the share button in SchedulePage's control row.
function ShareButtonMock() {
  return (
    <div className="w-8 h-8 shrink-0 flex items-center justify-center border border-accent text-accent" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" />
        <path d="M8 7l4-4 4 4" />
        <path d="M8 11H6.5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H16" />
      </svg>
    </div>
  )
}

// Non-interactive replica of a StagesSheet row: one visible + pinned stage, one hidden stage.
function StageFilterMock() {
  return (
    <div className="w-16 shrink-0 space-y-1" aria-hidden>
      <div className="h-5 border border-accent flex items-center gap-1 px-1 text-accent">
        <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2,7 6,11 12,3" /></svg>
        <div className="flex-1 h-1 bg-accent/60" />
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.8L12 17.3 5.8 20.8l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
      </div>
      <div className="h-5 border border-border flex items-center gap-1 px-1 text-text-secondary/40">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8" />
          <path d="M9.4 5.2A9 9 0 0112 5c5 0 9 7 9 7a13 13 0 01-2.2 2.7M6.1 6.2A13 13 0 003 12s4 7 9 7a9 9 0 003.6-.8" />
        </svg>
        <div className="flex-1 h-1 bg-text-secondary/20" />
      </div>
    </div>
  )
}

const HINTS: Record<HintId, { text: ReactNode; visual?: ReactNode }> = {
  set_sheet: { text: 'Tap a set. Bio, socials, music.', visual: <SocialIconsMock /> },
  picks: { text: <>Tap {PlusIcon} to build your own schedule. We'll handle the clashes.</>, visual: <ClashMock /> },
  share: { text: 'Send your schedule to the group. Link or poster.', visual: <div className="flex items-center gap-2 shrink-0"><ShareButtonMock /><PosterMock /></div> },
  stage_filter: { text: "Hide the stages you're skipping. Pin the rest to the top.", visual: <StageFilterMock /> },
  // Disabled for now (docs/onboarding-strategy.md) — not in HINT_ORDER, so this never shows.
  offline: { text: 'Works offline. Save your battery for the night.' },
}

/**
 * Renders the current first-session hint (one at a time, priority order,
 * capped per session — see src/lib/onboarding.ts). Dismiss = never again.
 * Pulses like a now-playing set (see .animate-pulse-glow) so it doesn't get lost.
 */
export function OnboardingHints() {
  const [hint, setHint] = useState<HintId | null>(() => nextHint(getSeenHints(), shownThisSession))

  useEffect(() => {
    if (!hint || captured.has(hint)) return
    captured.add(hint)
    shownThisSession += 1
    posthog.capture('onboarding_hint_shown', { hint_id: hint })
  }, [hint])

  useEffect(() => {
    if (!hint) return
    let el: HTMLElement | null = null
    const apply = () => {
      const all = document.querySelectorAll<HTMLElement>(`[data-onboarding-target="${hint}"]`)
      // Pick the first element whose bounding box is within the viewport.
      for (const candidate of all) {
        const r = candidate.getBoundingClientRect()
        if (r.top >= 0 && r.top < window.innerHeight && r.left >= 0 && r.left < window.innerWidth) {
          el = candidate; break
        }
      }
      if (!el && all.length) el = all[0]
      el?.classList.add('onboarding-target')
    }
    const raf = requestAnimationFrame(apply)
    return () => { cancelAnimationFrame(raf); el?.classList.remove('onboarding-target') }
  }, [hint])

  if (!hint) return null
  const { text, visual } = HINTS[hint]

  const dismiss = () => {
    markHintSeen(hint)
    posthog.capture('onboarding_hint_dismissed', { hint_id: hint })
    setHint(nextHint(getSeenHints(), shownThisSession))
  }

  return (
    <div className="border border-accent px-3 py-2.5 mt-2 flex items-center gap-3 animate-pulse-glow">
      {visual}
      <p className="flex-1 font-mono text-sm text-text-primary leading-snug">{text}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="text-text-secondary hover:text-text-primary px-1 font-mono"
      >
        ✕
      </button>
    </div>
  )
}
