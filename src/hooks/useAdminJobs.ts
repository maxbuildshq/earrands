import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/admin'
import type { EnrichmentJob } from '../types/database'

export function useAdminJobs() {
  return useQuery<EnrichmentJob[]>({
    queryKey: ['admin', 'jobs'],
    queryFn: () => adminFetch<EnrichmentJob[]>('admin-enrichment'),
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { type?: string; festival_slug?: string; artist_sort_names?: string[]; fields?: string[] }) =>
      adminFetch('admin-enrichment', { method: 'POST', body: params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] })
    },
  })
}

export function useJobAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'cancel' | 'retry' }) =>
      adminFetch('admin-enrichment', { method: 'PATCH', body: { id, action } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] })
    },
  })
}
