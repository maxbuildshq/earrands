type Props = {
  rating: -1 | 1 | null
  onRate: (value: -1 | 1) => void
}

export function RatingButtons({ rating, onRate }: Props) {
  return (
    <div className="flex">
      <button
        onClick={() => onRate(1)}
        title="Thumbs up"
        className={`w-8 h-8 flex items-center justify-center border-y border-l transition-colors ${
          rating === 1
            ? 'bg-acid text-surface border-acid'
            : 'bg-transparent text-text-secondary border-border hover:border-text-secondary'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={rating === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M7 22V11L2 13V22H7ZM7 11L11 2H12C13.1 2 14 2.9 14 4V9H20C21.1 9 22 10.1 21.7 11.2L19.2 20.2C19 21 18.3 21.5 17.5 21.5H7" />
        </svg>
      </button>
      <button
        onClick={() => onRate(-1)}
        title="Thumbs down"
        className={`w-8 h-8 flex items-center justify-center border transition-colors ${
          rating === -1
            ? 'bg-live text-white border-live'
            : 'bg-transparent text-text-secondary border-border hover:border-text-secondary'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={rating === -1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" style={{ transform: 'rotate(180deg)' }}>
          <path d="M7 22V11L2 13V22H7ZM7 11L11 2H12C13.1 2 14 2.9 14 4V9H20C21.1 9 22 10.1 21.7 11.2L19.2 20.2C19 21 18.3 21.5 17.5 21.5H7" />
        </svg>
      </button>
    </div>
  )
}
