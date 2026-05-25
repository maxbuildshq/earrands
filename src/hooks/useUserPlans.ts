import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { UserPlan } from '../types/database'
import posthog from 'posthog-js'

export function useUserPlans() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: plans = [] } = useQuery<UserPlan[]>({
    queryKey: ['user-plans', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', user!.id)
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const planSetIds = new Set(plans.map(p => p.set_id))

  const toggleMutation = useMutation({
    mutationFn: async (setId: string) => {
      const existing = plans.find(p => p.set_id === setId)
      if (existing) {
        const { error } = await supabase.from('user_plans').delete().eq('id', existing.id)
        if (error) throw error
        return { action: 'removed' as const, setId }
      } else {
        const { error } = await supabase.from('user_plans').insert({ user_id: user!.id, set_id: setId })
        if (error) throw error
        return { action: 'added' as const, setId }
      }
    },
    onMutate: async (setId) => {
      await queryClient.cancelQueries({ queryKey: ['user-plans', user?.id] })
      const prev = queryClient.getQueryData<UserPlan[]>(['user-plans', user?.id])

      queryClient.setQueryData<UserPlan[]>(['user-plans', user?.id], old => {
        if (!old) return old
        const exists = old.find(p => p.set_id === setId)
        if (exists) return old.filter(p => p.set_id !== setId)
        return [...old, { id: crypto.randomUUID(), user_id: user!.id, set_id: setId, created_at: new Date().toISOString() }]
      })

      return { prev }
    },
    onSuccess: (result) => {
      posthog.capture('set_plan_toggled', { set_id: result.setId, action: result.action })
    },
    onError: (_err, _setId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['user-plans', user?.id], context.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user-plans', user?.id] })
    },
  })

  return {
    plans,
    planSetIds,
    isGoing: (setId: string) => planSetIds.has(setId),
    toggleGoing: (setId: string) => toggleMutation.mutate(setId),
  }
}
