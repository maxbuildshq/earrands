import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { checkAdminAccess } from '../lib/admin'

type AdminAuthState = {
  isAdmin: boolean
  loading: boolean
}

export function useAdminAuth(): AdminAuthState {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    let cancelled = false
    checkAdminAccess().then(result => {
      if (!cancelled) {
        setIsAdmin(result)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [user, authLoading])

  return { isAdmin, loading }
}
