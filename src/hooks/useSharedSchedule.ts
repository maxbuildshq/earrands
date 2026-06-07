import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { SharedSchedule } from '../types/database'

function generateCode(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

export function useSharedScheduleByCode(code: string | undefined) {
  return useQuery<SharedSchedule | null>({
    queryKey: ['shared-schedule', code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_schedules')
        .select('*')
        .eq('code', code!)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!code,
  })
}

export function useCreateSharedSchedule() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ festivalId, setIds }: { festivalId: string; setIds: string[] }) => {
      const { data: existing } = await supabase
        .from('shared_schedules')
        .select('id, code')
        .eq('user_id', user!.id)
        .eq('festival_id', festivalId)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('shared_schedules')
          .update({ set_ids: setIds, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
        return existing.code
      }

      const code = generateCode()
      const { error } = await supabase
        .from('shared_schedules')
        .insert({ code, user_id: user!.id, festival_id: festivalId, set_ids: setIds })
      if (error) throw error
      return code
    },
  })
}
