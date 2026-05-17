import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Festival, Stage, SetWithStage } from '../types/database'

export function useFestival() {
  return useQuery<Festival>({
    queryKey: ['festival'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('slug', 'awakenings-upclose-2026')
        .single()
      if (error) throw error
      return data
    },
    staleTime: 24 * 60 * 60 * 1000,
  })
}

export function useStages(festivalId: string | undefined) {
  return useQuery<Stage[]>({
    queryKey: ['stages', festivalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stages')
        .select('*')
        .eq('festival_id', festivalId!)
        .order('sort_order')
      if (error) throw error
      return data
    },
    enabled: !!festivalId,
    staleTime: 24 * 60 * 60 * 1000,
  })
}

export function useSets(festivalId: string | undefined) {
  return useQuery<SetWithStage[]>({
    queryKey: ['sets', festivalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sets')
        .select('*, stages(name, sort_order)')
        .eq('festival_id', festivalId!)
        .order('start_time')
      if (error) throw error
      return data as SetWithStage[]
    },
    enabled: !!festivalId,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
