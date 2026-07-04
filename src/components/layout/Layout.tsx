import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const canGoBack = /^\/festivals\//.test(pathname)

  // Swipe-right → back to the festival list. Active across the whole screen EXCEPT
  // horizontally-scrollable surfaces (the timetable set-area, the day strip), which opt out
  // via [data-swipe-back="exclude"] so the gesture never fights their own horizontal scroll.
  // This mirrors how iOS/Android suppress the back-swipe over carousels/maps. The event title
  // (a link home) is the explicit fallback.
  useEffect(() => {
    if (!canGoBack) return
    let startX = 0
    let startY = 0
    let tracking = false
    const onStart = (e: TouchEvent) => {
      const target = e.target as Element | null
      if (target?.closest('[data-swipe-back="exclude"]')) return
      if (e.touches[0].clientX > window.innerWidth * 0.2) return
      tracking = true
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (t.clientX - startX > 70 && Math.abs(t.clientY - startY) < 50) navigate('/')
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [canGoBack, navigate])

  return (
    <div className="min-h-screen pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <Header />
      <main className="mx-auto px-4 pb-20">
        <Outlet />
      </main>
    </div>
  )
}
