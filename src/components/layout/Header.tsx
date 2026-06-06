import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { FeedbackButton } from '../feedback/FeedbackButton'

export function Header() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  // Extract slug from /festivals/:slug/* paths
  const slugMatch = location.pathname.match(/^\/festivals\/([^/]+)/)
  const slug = slugMatch ? slugMatch[1] : null

  const isActive = (path: string) => location.pathname.includes(path)

  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-mono font-bold text-acid text-sm tracking-tight">
          earrands
        </Link>

        <nav className="flex items-center gap-1">
          {slug && (
            <>
              <Link
                to={`/festivals/${slug}/schedule`}
                className={`px-3 py-1.5 text-sm font-medium uppercase tracking-wider transition-colors ${
                  isActive('/schedule') ? 'text-acid' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Schedule
              </Link>

              {user && (
                <Link
                  to={`/festivals/${slug}/my-schedule`}
                  className={`px-3 py-1.5 text-sm font-medium uppercase tracking-wider transition-colors ${
                    isActive('/my-schedule') ? 'text-acid' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  My Sets
                </Link>
              )}
            </>
          )}

          <FeedbackButton />

          {user ? (
            <button
              onClick={signOut}
              className="ml-2 px-3 py-1.5 text-xs font-mono text-text-secondary hover:text-text-primary border border-border hover:border-text-secondary transition-colors uppercase"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/login"
              className="ml-2 px-3 py-1.5 text-xs font-mono text-surface bg-acid hover:bg-acid-dim transition-colors uppercase font-bold"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
