import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { UserRating } from '../types/database'
import posthog from 'posthog-js'

export function useUserRatings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: ratings = [] } = useQuery<UserRating[]>({
    queryKey: ['user-ratings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_ratings')
        .select('*')
        .eq('user_id', user!.id)
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const ratingsMap = new Map(ratings.map(r => [r.set_id, r]))

  const rateMutation = useMutation({
    mutationFn: async ({ setId, value }: { setId: string; value: -1 | 1 }) => {
      const existing = ratingsMap.get(setId)

      if (existing && existing.rating === value) {
        const { error } = await supabase.from('user_ratings').delete().eq('id', existing.id)
        if (error) throw error
        return { action: 'removed' as const }
      }

      if (existing) {
        const { error } = await supabase.from('user_ratings').update({ rating: value }).eq('id', existing.id)
        if (error) throw error
        return { action: 'updated' as const }
      }

      const { error } = await supabase.from('user_ratings').insert({ user_id: user!.id, set_id: setId, rating: value })
      if (error) throw error
      return { action: 'added' as const }
    },
    onMutate: async ({ setId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['user-ratings', user?.id] })
      const prev = queryClient.getQueryData<UserRating[]>(['user-ratings', user?.id])

      queryClient.setQueryData<UserRating[]>(['user-ratings', user?.id], old => {
        if (!old) return old
        const existing = old.find(r => r.set_id === setId)

        if (existing && existing.rating === value) {
          return old.filter(r => r.set_id !== setId)
        }

        if (existing) {
          return old.map(r => r.set_id === setId ? { ...r, rating: value } : r)
        }

        return [...old, { id: crypto.randomUUID(), user_id: user!.id, set_id: setId, rating: value, created_at: new Date().toISOString() }]
      })

      return { prev }
    },
    onSuccess: (_result, { setId, value }) => {
      posthog.capture('set_rated', { set_id: setId, rating: value })
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['user-ratings', user?.id], context.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ratings', user?.id] })
    },
  })

  return {
    ratings,
    getRating: (setId: string): -1 | 1 | null => ratingsMap.get(setId)?.rating ?? null,
    setRating: (setId: string, value: -1 | 1) => rateMutation.mutate({ setId, value }),
  }
}
