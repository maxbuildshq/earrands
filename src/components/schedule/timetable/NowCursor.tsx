export function NowCursor({ left, height }: { left: number; height: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 z-20 animate-pulse"
      style={{ left, height, width: 2, background: 'var(--color-accent)', boxShadow: '0 0 8px var(--color-accent)' }}
    />
  )
}
