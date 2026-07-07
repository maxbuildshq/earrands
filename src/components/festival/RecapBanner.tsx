import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { Button } from '../ui/Button'
import type { RecapDataLevel } from '../../lib/recap'
import type { Festival } from '../../types/database'

type Props = {
  festival: Festival
  level: RecapDataLevel
  surface: 'list' | 'schedule'
  onOpen: () => void
}

const dismissKey = (festivalId: string) => `recap-banner:${festivalId}`

export function RecapBanner({ festival, level, surface, onOpen }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(dismissKey(festival.id)) } catch { return false }
  })

  useEffect(() => {
    if (!dismissed) {
      posthog.capture('recap_banner_shown', { festival_name: festival.name, data_level: level, surface })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (dismissed) return null

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(festival.id), '1') } catch { /* ignore */ }
    setDismissed(true)
    posthog.capture('recap_banner_dismissed', { festival_name: festival.name, surface })
  }

  return (
    <div className="border border-accent bg-surface-raised p-4 mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-mono text-xs text-accent uppercase tracking-wider">That's a wrap</div>
        <div className="font-mono text-sm text-text-primary mt-1 truncate">
          {surface === 'list' ? festival.name : 'Your festival, one image.'}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="accent-outline" fullWidth={false} onClick={onOpen} className="px-3 py-2 whitespace-nowrap">
          Get my recap
        </Button>
        <Button variant="icon" fullWidth={false} onClick={dismiss} title="Dismiss" aria-label="Dismiss">
          ✕
        </Button>
      </div>
    </div>
  )
}
