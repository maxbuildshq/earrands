import { Link, useLocation } from 'react-router-dom'

type Props = {
  message: string
}

/**
 * Shown inside a BottomSheet when an anonymous user triggers a login-gated action
 * (request a festival / follow for timetable alerts). The action is the conversion moment.
 */
export function AuthPrompt({ message }: Props) {
  const location = useLocation()
  const returnTo = location.pathname + location.search

  return (
    <div className="px-4 pb-8 pt-1">
      <p className="text-text-primary text-sm leading-relaxed mb-5">{message}</p>
      <div className="flex flex-col gap-2">
        <Link
          to="/signup"
          state={{ returnTo }}
          className="w-full text-center bg-accent text-surface font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:bg-accent-dim transition-colors"
        >
          Create account
        </Link>
        <Link
          to="/login"
          state={{ returnTo }}
          className="w-full text-center border border-border text-text-secondary font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:border-text-secondary hover:text-text-primary transition-colors"
        >
          Log in
        </Link>
      </div>
    </div>
  )
}
