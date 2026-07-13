import { useQuery } from '@tanstack/react-query'
import { adminFetch } from '../lib/admin'

export type ApiUsageRow = { vendor: string; day: string; count: number }

export function useAdminApiUsage() {
  return useQuery<{ data: ApiUsageRow[] }>({
    queryKey: ['admin', 'api-usage'],
    queryFn: () => adminFetch<{ data: ApiUsageRow[] }>('admin-usage'),
    staleTime: 60_000,
  })
}
