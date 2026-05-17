import { useState, useEffect } from 'react'

export function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-conflict text-surface text-center py-2 px-4 font-mono text-xs uppercase tracking-wider">
      Offline — actions will sync when you reconnect
    </div>
  )
}
