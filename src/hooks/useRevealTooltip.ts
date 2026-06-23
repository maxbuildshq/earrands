import { useCallback, useEffect, useRef, useState } from 'react'

const REVEAL_MS = 2000

// Tap-to-reveal: shows a temporary tooltip for an item (e.g. a truncated stage
// name) that auto-dismisses without requiring a second tap to close.
export function useRevealTooltip() {
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reveal = useCallback((id: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setRevealedId(id)
    timeoutRef.current = setTimeout(() => setRevealedId(null), REVEAL_MS)
  }, [])

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  return { revealedId, reveal }
}
