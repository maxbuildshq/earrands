import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { FestivalRequest } from '../types/database'
import posthog from 'posthog-js'

export function useFestivalRequests() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: requests = [] } = useQuery<FestivalRequest[]>({
    queryKey: ['festival-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const submitMutation = useMutation({
    mutationFn: async ({ rawName, region }: { rawName: string; region?: string }) => {
      const { error } = await supabase.from('festival_requests').insert({
        user_id: user!.id,
        raw_name: rawName.trim(),
        region: region?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      posthog.capture('festival_requested', { raw_name: vars.rawName.trim(), has_region: !!vars.region?.trim() })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['festival-requests', user?.id] })
    },
  })

  return {
    requests,
    submitRequest: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  }
}
