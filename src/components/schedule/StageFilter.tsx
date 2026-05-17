import type { Stage } from '../../types/database'

type Props = {
  stages: Stage[]
  selected: Set<string>
  onToggle: (stageId: string) => void
  onSelectAll: () => void
}

export function StageFilter({ stages, selected, onToggle, onSelectAll }: Props) {
  const allSelected = selected.size === stages.length

  return (
    <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4 scrollbar-none">
      <button
        onClick={onSelectAll}
        className={`shrink-0 px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
          allSelected
            ? 'border-acid text-acid'
            : 'border-border text-text-secondary hover:border-text-secondary'
        }`}
      >
        All
      </button>
      {stages.map(stage => {
        const active = selected.has(stage.id)
        return (
          <button
            key={stage.id}
            onClick={() => onToggle(stage.id)}
            className={`shrink-0 px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
              active
                ? 'border-acid text-acid'
                : 'border-border text-text-secondary hover:border-text-secondary'
            }`}
          >
            {stage.name}
          </button>
        )
      })}
    </div>
  )
}
