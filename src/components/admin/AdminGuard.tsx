import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import type { ReactNode } from 'react'

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="text-text-secondary font-mono text-sm tracking-wider">LOADING...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />
  }

  return <>{children}</>
}
