import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { isInRecapWindow } from '../lib/recap'
import type { RecapDataLevel } from '../lib/recap'
import type { Festival } from '../types/database'

type RecapCandidate = { festival: Festival; level: Exclude<RecapDataLevel, 'none'> }

/**
 * Find the festival to pitch a recap for on the festival list: recently ended
 * (within the recap window) and the user has picks or thumbs-ups in it. Light
 * joined queries so we never load full set lists here. Most recently ended
 * festival wins if several qualify.
 */
export function useRecapEligibility(festivals: Festival[]): RecapCandidate | null {
  const { user } = useAuth()

  const ended = festivals.filter(f => isInRecapWindow(f))
  const endedIds = ended.map(f => f.id)

  const { data } = useQuery({
    queryKey: ['recap-eligibility', user?.id, endedIds],
    queryFn: async () => {
      const [plansRes, lovedRes] = await Promise.all([
        supabase
          .from('user_plans')
          .select('sets!inner(festival_id)')
          .eq('user_id', user!.id)
          .in('sets.festival_id', endedIds),
        supabase
          .from('user_ratings')
          .select('sets!inner(festival_id)')
          .eq('user_id', user!.id)
          .eq('rating', 1)
          .in('sets.festival_id', endedIds),
      ])
      if (plansRes.error) throw plansRes.error
      if (lovedRes.error) throw lovedRes.error
      const festivalIds = (rows: { sets: unknown }[] | null) => {
        const ids = new Set<string>()
        for (const row of rows ?? []) {
          const sets = row.sets as { festival_id: string } | { festival_id: string }[] | null
          if (!sets) continue
          for (const s of Array.isArray(sets) ? sets : [sets]) ids.add(s.festival_id)
        }
        return ids
      }
      return { planned: festivalIds(plansRes.data), loved: festivalIds(lovedRes.data) }
    },
    enabled: !!user && endedIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  if (!data) return null

  // Most recently ended first
  const candidates = [...ended].sort((a, b) => b.end_date.localeCompare(a.end_date))
  for (const festival of candidates) {
    if (data.loved.has(festival.id)) return { festival, level: 'ratings' }
    if (data.planned.has(festival.id)) return { festival, level: 'picks' }
  }
  return null
}
