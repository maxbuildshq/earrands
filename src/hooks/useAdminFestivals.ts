import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/admin'
import type { Festival, ParseSuggestion } from '../types/database'

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

type SetUpdate = {
  setId: string
  artist_name?: string
  stage_id?: string | null
  start_time?: string | null
  end_time?: string | null
  day?: string
}

export function useUpdateSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ setId, ...updates }: SetUpdate) =>
      adminFetch('admin-festivals', { method: 'POST', body: { action: 'update_set', set_id: setId, ...updates } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sets'] })
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

export function useParseSuggestions(festivalId: string | undefined) {
  return useQuery<ParseSuggestion[]>({
    queryKey: ['admin', 'parse-suggestions', festivalId],
    queryFn: () => adminFetch<ParseSuggestion[]>('admin-festivals', {
      params: { action: 'parse_suggestions', festival_id: festivalId! },
    }),
    enabled: !!festivalId,
    staleTime: 30_000,
  })
}

export function useReviewSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ suggestionId, status }: { suggestionId: string; status: ParseSuggestion['status'] }) =>
      adminFetch('admin-festivals', { method: 'POST', body: { action: 'review_suggestion', suggestion_id: suggestionId, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'parse-suggestions'] })
    },
  })
}

export type PipelineCounters = {
  sets: number
  sets_with_artists: number
  artists: number
  artists_enriched: number
  artists_reviewed: number
  suggestions_pending: number
  followers: number
  followers_notified: number
}

export function usePipelineCounters(festivalId: string | undefined) {
  return useQuery<PipelineCounters>({
    queryKey: ['admin', 'pipeline', festivalId],
    queryFn: () => adminFetch<PipelineCounters>('admin-festivals', {
      params: { action: 'pipeline', festival_id: festivalId! },
    }),
    enabled: !!festivalId,
    staleTime: 15_000,
    refetchInterval: 30_000, // live counters while jobs run
  })
}
