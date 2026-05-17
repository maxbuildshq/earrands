type Props = {
  isGoing: boolean
  onToggle: () => void
}

export function GoingToggle({ isGoing, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      title={isGoing ? 'Remove from my sets' : 'Add to my sets'}
      className={`w-8 h-8 flex items-center justify-center border transition-colors ${
        isGoing
          ? 'bg-acid text-surface border-acid'
          : 'bg-transparent text-text-secondary border-border hover:border-text-secondary'
      }`}
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
    </button>
  )
}
