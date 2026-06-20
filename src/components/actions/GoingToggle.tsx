import { Button } from '../ui/Button'

type Props = {
  isGoing: boolean
  onToggle: () => void
}

export function GoingToggle({ isGoing, onToggle }: Props) {
  return (
    <Button
      variant="icon-toggle"
      active={isGoing}
      onClick={onToggle}
      title={isGoing ? 'Remove from my sets' : 'Add to my sets'}
      aria-pressed={isGoing}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
        {isGoing ? (
          <polyline points="2,7 6,11 12,3" />
        ) : (
          <>
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </>
        )}
      </svg>
    </Button>
  )
}
