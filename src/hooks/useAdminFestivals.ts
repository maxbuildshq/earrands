import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/admin'
import type { Festival } from '../types/database'

export function useAdminFestivals() {
  return useQuery<Festival[]>({
    queryKey: ['admin', 'festivals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .order('start_date', { ascending: false })
      if (error) throw error
      return data
    },
    staleTime: 30_000,
  })
}

export function useAdminFestival(id: string | undefined) {
  return useQuery<Festival>({
    queryKey: ['admin', 'festival', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

type FestivalStats = {
  id: string
  stages_count: number
  sets_count: number
  artists_count: number
  followers_count: number
}

export function useAdminFestivalStats() {
  return useQuery<FestivalStats[]>({
    queryKey: ['admin', 'festival-stats'],
    queryFn: () => adminFetch<FestivalStats[]>('admin-festivals', { params: { action: 'stats' } }),
    staleTime: 30_000,
  })
}

export function useUpdateFestival() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: Partial<Festival> & { id: string }) =>
      adminFetch('admin-festivals', { method: 'PUT', body: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'festivals'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'festival'] })
    },
  })
}

export function useUpdateStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stageId, name }: { stageId: string; name: string }) =>
      adminFetch('admin-festivals', { method: 'POST', body: { action: 'update_stage', stage_id: stageId, name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] })
    },
  })
}

export function useToggleFestivalField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: 'published' | 'timetable_announced'; value: boolean }) =>
      adminFetch('admin-festivals', { method: 'PATCH', body: { id, [field]: value } }),
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'festivals'] })
      const prev = queryClient.getQueryData<Festival[]>(['admin', 'festivals'])
      queryClient.setQueryData<Festival[]>(['admin', 'festivals'], old =>
        old?.map(f => f.id === id ? { ...f, [field]: value } : f) ?? [],
      )
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['admin', 'festivals'], context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'festivals'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'festival'] })
    },
  })
}
