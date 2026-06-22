import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/admin'
import type { EnrichmentJob } from '../types/database'

export function useAdminJobs() {
  const queryClient = useQueryClient()
  const prevRunning = useRef(new Set<string>())

  return useQuery<EnrichmentJob[]>({
    queryKey: ['admin', 'jobs'],
    queryFn: async () => {
      const jobs = await adminFetch<EnrichmentJob[]>('admin-enrichment')
      const nowRunning = new Set(jobs.filter(j => j.status === 'running').map(j => j.id))
      const justCompleted = [...prevRunning.current].some(id => !nowRunning.has(id))
      if (justCompleted) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'artist'] })
      }
      prevRunning.current = nowRunning
      return jobs
    },
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
    mutationFn: ({ id, action }: { id: string; action: 'cancel' | 'retry' | 'mark_done' }) =>
      adminFetch('admin-enrichment', { method: 'PATCH', body: { id, action } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] })
    },
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      adminFetch('admin-enrichment', { method: 'DELETE', body: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] })
    },
  })
}
