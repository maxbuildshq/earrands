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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-negative text-white text-center py-2 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] font-mono font-bold text-sm uppercase tracking-wider whitespace-nowrap">
      Offline. Everything still works.
    </div>
  )
}
