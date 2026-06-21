import { Button } from '../ui/Button'

type Props = {
  count: number
  onApprove: () => void
  onEnrich: () => void
  onClear: () => void
  isPending?: boolean
}

export function BulkActionBar({ count, onApprove, onEnrich, onClear, isPending }: Props) {
  if (count === 0) return null
  return (
    <div className="sticky bottom-0 z-10 bg-surface-raised border-t border-border px-4 py-3 flex items-center gap-4">
      <span className="font-mono text-sm text-accent font-bold">{count} selected</span>
      <Button variant="primary" fullWidth={false} onClick={onApprove} disabled={isPending}>
        Approve All
      </Button>
      <Button variant="secondary" fullWidth={false} onClick={onEnrich} disabled={isPending}>
        Enrich Selected
      </Button>
      <Button variant="secondary" fullWidth={false} onClick={onClear}>
        Clear
      </Button>
    </div>
  )
}
