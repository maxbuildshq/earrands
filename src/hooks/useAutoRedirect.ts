import { useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFestivals } from './useFestivalData'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { Festival } from '../types/database'

const LAST_OPENED_KEY = 'earrands:lastOpenedFestival'
const REDIRECT_DONE_KEY = 'earrands:autoRedirectDone'
const CUTOFF_MS = 14 * 24 * 60 * 60 * 1000

export function isOngoing(festival: Festival): boolean {
  const now = new Date()
  const start = new Date(festival.start_date + 'T00:00:00')
  const endNextDay = new Date(festival.end_date + 'T00:00:00')
  endNextDay.setDate(endNextDay.getDate() + 1)
  endNextDay.setHours(7, 0, 0, 0)
  return start <= now && now <= endNextDay
}

function getLastOpened(): { slug: string; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(LAST_OPENED_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveLastOpened(slug: string) {
  try { localStorage.setItem(LAST_OPENED_KEY, JSON.stringify({ slug, timestamp: Date.now() })) } catch { /* ignore */ }
}

export function useAutoRedirect(): { redirectTo: string | null; isChecking: boolean } {
  const { user } = useAuth()
  const { data: festivals, isLoading: festivalsLoading } = useFestivals()
  const decided = useRef<{ redirectTo: string | null } | null>(null)

  const cutoffDate = useMemo(() => new Date(Date.now() - CUTOFF_MS).toISOString(), [])

  const { data: planFestivalIds, isLoading: plansLoading } = useQuery<string[]>({
    queryKey: ['user-plan-festival-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_plans')
        .select('sets(festival_id)')
        .eq('user_id', user!.id)
        .gte('created_at', cutoffDate)
      if (error) throw error
      const ids = new Set<string>()
      for (const row of data ?? []) {
        const sets = row.sets as unknown as { festival_id: string } | { festival_id: string }[] | null
        if (!sets) continue
        if (Array.isArray(sets)) {
          for (const s of sets) ids.add(s.festival_id)
        } else {
          ids.add(sets.festival_id)
        }
      }
      return [...ids]
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  if (decided.current) return { redirectTo: decided.current.redirectTo, isChecking: false }

  if (!user) return { redirectTo: null, isChecking: false }

  try {
    if (sessionStorage.getItem(REDIRECT_DONE_KEY)) {
      decided.current = { redirectTo: null }
      return { redirectTo: null, isChecking: false }
    }
  } catch {
    decided.current = { redirectTo: null }
    return { redirectTo: null, isChecking: false }
  }

  const isChecking = festivalsLoading || plansLoading
  if (isChecking) return { redirectTo: null, isChecking: true }

  try { sessionStorage.setItem(REDIRECT_DONE_KEY, '1') } catch { /* ignore */ }

  const ongoing = (festivals ?? []).filter(isOngoing)
  if (ongoing.length === 0) {
    decided.current = { redirectTo: null }
    return { redirectTo: null, isChecking: false }
  }

  const withPlans = ongoing.filter(f => planFestivalIds?.includes(f.id))
  if (withPlans.length === 1) {
    decided.current = { redirectTo: `/festivals/${withPlans[0].slug}/schedule` }
    return { redirectTo: decided.current.redirectTo, isChecking: false }
  }

  const lastOpened = getLastOpened()
  if (lastOpened) {
    const match = ongoing.find(f => f.slug === lastOpened.slug)
    if (match) {
      decided.current = { redirectTo: `/festivals/${match.slug}/schedule` }
      return { redirectTo: decided.current.redirectTo, isChecking: false }
    }
  }

  if (ongoing.length === 1) {
    decided.current = { redirectTo: `/festivals/${ongoing[0].slug}/schedule` }
    return { redirectTo: decided.current.redirectTo, isChecking: false }
  }

  decided.current = { redirectTo: null }
  return { redirectTo: null, isChecking: false }
}
