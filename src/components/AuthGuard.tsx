import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { ReactNode } from 'react'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-text-secondary font-mono text-sm tracking-wider">LOADING...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />
  }

  return <>{children}</>
}
