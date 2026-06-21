import { Badge } from '../ui/Badge'

type Props = {
  status: string | null
}

const STATUS_VARIANT = {
  pending: 'outline',
  enriched: 'accent-outline',
  reviewed: 'accent',
} as const

const STATUS_LABEL = {
  pending: 'Pending',
  enriched: 'Enriched',
  reviewed: 'Reviewed',
} as const

export function EnrichmentStatusBadge({ status }: Props) {
  const key = (status ?? 'pending') as keyof typeof STATUS_VARIANT
  const variant = STATUS_VARIANT[key] ?? 'outline'
  const label = STATUS_LABEL[key] ?? status ?? 'Unknown'
  return <Badge variant={variant}>{label}</Badge>
}
