import { useMemo } from 'react'
import type { Stage } from '../../types/database'
import { BottomSheet } from '../common/BottomSheet'
import { Button } from '../ui/Button'

type Props = {
  stages: Stage[]
  hidden: Set<string>
  pinned: string[]
  onToggleHidden: (id: string) => void
  onTogglePin: (id: string) => void
  onShowAll: () => void
  onClose: () => void
}

export function StagesSheet({ stages, hidden, pinned, onToggleHidden, onTogglePin, onShowAll, onClose }: Props) {
  const visibleCount = stages.filter(s => !hidden.has(s.id)).length

  // Sheet order: pinned first (in pin order), then the rest by sort_order — hidden rows stay listed (dimmed).
  const ordered = useMemo(() => {
    const pinnedSet = new Set(pinned)
    const pinnedStages = pinned.map(id => stages.find(s => s.id === id)).filter((s): s is Stage => !!s)
    const rest = stages.filter(s => !pinnedSet.has(s.id)).sort((a, b) => a.sort_order - b.sort_order)
    return [...pinnedStages, ...rest]
  }, [stages, pinned])

  return (
    <BottomSheet title="STAGES" onClose={onClose}>
      <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">
          {visibleCount}/{stages.length} shown
        </span>
        <Button
          variant="accent-outline"
          fullWidth={false}
          onClick={onShowAll}
          disabled={hidden.size === 0}
          className="!py-1.5 !px-3 !text-xs disabled:!opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent"
        >
          Show all
        </Button>
      </div>

      <div>
        {ordered.map(stage => {
          const visible = !hidden.has(stage.id)
          const isPinned = pinned.includes(stage.id)
          const isLastVisible = visible && visibleCount <= 1
          return (
            <div key={stage.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
              <Button
                variant="icon-toggle"
                active={visible}
                onClick={() => onToggleHidden(stage.id)}
                disabled={isLastVisible}
                title={visible ? 'Hide stage' : 'Show stage'}
                aria-pressed={visible}
                className="shrink-0 disabled:!opacity-40"
              >
                {visible ? (
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="2,7 6,11 12,3" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8" />
                    <path d="M9.4 5.2A9 9 0 0112 5c5 0 9 7 9 7a13 13 0 01-2.2 2.7M6.1 6.2A13 13 0 003 12s4 7 9 7a9 9 0 003.6-.8" />
                  </svg>
                )}
              </Button>

              <span className={`flex-1 min-w-0 font-mono font-bold text-sm uppercase leading-tight break-words ${visible ? 'text-text-primary' : 'text-text-secondary/40'}`}>
                {stage.name}
              </span>

              <button
                onClick={() => onTogglePin(stage.id)}
                title={isPinned ? 'Unpin' : 'Pin to top'}
                aria-pressed={isPinned}
                className={`shrink-0 w-8 h-8 flex items-center justify-center transition-colors ${
                  isPinned ? 'text-accent' : 'text-border hover:text-text-secondary'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.8L12 17.3 5.8 20.8l1.6-6.8L2.2 8.9l6.9-.6z" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
      </div>
    </BottomSheet>
  )
}
