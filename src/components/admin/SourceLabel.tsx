type Props = {
  source: string | null | undefined
}

const LABELS: Record<string, string> = {
  soundcloud: 'SC',
  discogs: 'Discogs',
  brave: 'Search',
  festival: 'Festival',
  generated: 'AI',
  manual: 'Manual',
}

function resolveLabel(source: string): string {
  if (source.startsWith('festival:')) {
    const slug = source.split(':')[1]
    return slug.charAt(0).toUpperCase() + slug.slice(1)
  }
  return LABELS[source] ?? source
}

export function SourceLabel({ source }: Props) {
  if (!source) return null
  return (
    <span className="font-mono text-xs text-text-secondary ml-1">
      [{resolveLabel(source)}]
    </span>
  )
}
