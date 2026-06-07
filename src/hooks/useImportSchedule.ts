import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import posthog from 'posthog-js'

export function useImportSchedule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ setIds, festivalName }: { setIds: string[]; festivalName: string }) => {
      const rows = setIds.map(set_id => ({ user_id: user!.id, set_id }))
      const { error } = await supabase
        .from('user_plans')
        .upsert(rows, { onConflict: 'user_id,set_id', ignoreDuplicates: true })
      if (error) throw error

      posthog.capture('shared_schedule_saved', {
        festival_name: festivalName,
        set_count: setIds.length,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user-plans', user?.id] })
    },
  })
}
