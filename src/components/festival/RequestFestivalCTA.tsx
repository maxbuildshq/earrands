import { useState } from 'react'
import { RequestFestivalSheet } from './RequestFestivalSheet'

export function RequestFestivalCTA() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 border border-border bg-surface-raised px-4 py-3 text-left hover:border-accent/50 transition-colors group"
      >
        <span className="font-mono text-sm text-text-secondary">Don't see your festival?</span>
        <span className="font-mono font-bold text-sm text-accent uppercase tracking-wider group-hover:text-accent-dim shrink-0">Request it →</span>
      </button>
      {open && <RequestFestivalSheet onClose={() => setOpen(false)} />}
    </>
  )
}
