import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { FestivalFollow } from '../types/database'
import posthog from 'posthog-js'

export function useFestivalFollows() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: follows = [] } = useQuery<FestivalFollow[]>({
    queryKey: ['festival-follows', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_follows')
        .select('*')
        .eq('user_id', user!.id)
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const followedIds = new Set(follows.map(f => f.festival_id))

  const toggleMutation = useMutation({
    mutationFn: async (festivalId: string) => {
      const existing = follows.find(f => f.festival_id === festivalId)
      if (existing) {
        const { error } = await supabase.from('festival_follows').delete().eq('id', existing.id)
        if (error) throw error
        return { action: 'removed' as const, festivalId }
      } else {
        const { error } = await supabase.from('festival_follows').insert({ user_id: user!.id, festival_id: festivalId })
        if (error) throw error
        return { action: 'added' as const, festivalId }
      }
    },
    onMutate: async (festivalId) => {
      await queryClient.cancelQueries({ queryKey: ['festival-follows', user?.id] })
      const prev = queryClient.getQueryData<FestivalFollow[]>(['festival-follows', user?.id])

      queryClient.setQueryData<FestivalFollow[]>(['festival-follows', user?.id], old => {
        if (!old) return old
        const exists = old.find(f => f.festival_id === festivalId)
        if (exists) return old.filter(f => f.festival_id !== festivalId)
        return [...old, { id: crypto.randomUUID(), user_id: user!.id, festival_id: festivalId, notified_at: null, created_at: new Date().toISOString() }]
      })

      return { prev }
    },
    onSuccess: (result) => {
      posthog.capture('festival_followed', { festival_id: result.festivalId, action: result.action })
    },
    onError: (_err, _festivalId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['festival-follows', user?.id], context.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['festival-follows', user?.id] })
    },
  })

  return {
    follows,
    followedIds,
    isFollowing: (festivalId: string) => followedIds.has(festivalId),
    toggleFollow: (festivalId: string) => toggleMutation.mutate(festivalId),
  }
}
