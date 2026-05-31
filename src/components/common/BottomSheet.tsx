import { useEffect, useRef, useCallback, type ReactNode } from 'react'

type Props = {
  title?: string
  onClose: () => void
  children: ReactNode
}

/**
 * Reusable bottom-sheet shell — backdrop, slide-up, swipe-to-dismiss, Escape, scroll-lock.
 * Mirrors the interaction model of SetSheet; used by the request/follow flows.
 */
export function BottomSheet({ title, onClose, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const touchCurrentY = useRef(0)
  const isDragging = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }, [onClose])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    isDragging.current = false
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY
    const delta = touchCurrentY.current - touchStartY.current
    if (delta > 0) {
      isDragging.current = true
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${delta}px)`
        sheetRef.current.style.transition = 'none'
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const delta = touchCurrentY.current - touchStartY.current
    if (sheetRef.current) {
      sheetRef.current.style.transition = ''
      sheetRef.current.style.transform = ''
    }
    if (isDragging.current && delta > 100) {
      onClose()
    }
    isDragging.current = false
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/60 animate-fade-in"
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-surface-raised border-t border-border animate-slide-up overflow-hidden flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 shrink-0 flex items-start justify-between gap-3">
          {title ? (
            <h2 className="font-mono font-bold text-lg text-text-primary leading-tight">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors shrink-0"
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}
