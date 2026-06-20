import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useFestival } from '../../hooks/useFestivalData'
import { FeedbackButton } from '../feedback/FeedbackButton'
import { Button, ICON_BARE_CLASS } from '../ui/Button'
import { formatDateRange } from '../../lib/dates'

/** Slug of the festival schedule route, if we're on it (e.g. /festivals/dekmantel/schedule). */
function scheduleSlug(pathname: string): string | undefined {
  return pathname.match(/^\/festivals\/([^/]+)\/schedule/)?.[1]
}

function AuthIcon() {
  const { user, signOut } = useAuth()
  if (user) {
    return (
      <Button variant="icon-bare" onClick={signOut} title="Log out" aria-label="Log out">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </Button>
    )
  }
  return (
    <Link
      to="/login"
      title="Log in"
      aria-label="Log in"
      className={ICON_BARE_CLASS}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    </Link>
  )
}

export function Header() {
  const { pathname } = useLocation()
  const slug = scheduleSlug(pathname)
  const { data: festival } = useFestival(slug)
  const onFestival = !!(slug && festival)

  // Row 1 is identical everywhere: a left wordmark/title (→ home) + the same right-icon cluster.
  // On a festival the wordmark is swapped for the event title (also a link home — back affordance);
  // a date/location sub-line is appended below without changing row 1's size or position.
  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="max-w-2xl mx-auto px-4">
        <div className="h-14 flex items-center justify-between gap-3">
          <Link
            to="/"
            aria-label={onFestival ? 'Back to festivals' : undefined}
            className="font-mono font-bold text-accent text-lg tracking-tight truncate min-w-0"
          >
            {onFestival ? festival.name : 'EARRANDS'}
          </Link>
          <nav className="flex items-center shrink-0">
            <FeedbackButton />
            <AuthIcon />
          </nav>
        </div>

        {onFestival && (
          <div className="flex items-center gap-2 pb-2 -mt-1">
            <span className="font-mono text-sm text-text-secondary tracking-wider">
              {formatDateRange(festival.start_date, festival.end_date)}
            </span>
            {festival.location && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(festival.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open location in maps"
                className="shrink-0 text-text-secondary hover:text-accent transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
