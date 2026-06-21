import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/admin'
import type { Artist } from '../types/database'

type ArtistListResponse = { data: Artist[]; count: number }

type ArtistFilters = {
  festivalId?: string
  status?: string
  search?: string
  limit?: number
  offset?: number
}

export function useAdminArtists(filters: ArtistFilters = {}) {
  const params: Record<string, string> = {}
  if (filters.festivalId) params.festival_id = filters.festivalId
  if (filters.status) params.status = filters.status
  if (filters.search) params.search = filters.search
  if (filters.limit) params.limit = String(filters.limit)
  if (filters.offset) params.offset = String(filters.offset)

  return useQuery<ArtistListResponse>({
    queryKey: ['admin', 'artists', params],
    queryFn: () => adminFetch<ArtistListResponse>('admin-artists', { params }),
    staleTime: 30_000,
  })
}

export function useAdminArtist(id: string | undefined) {
  return useQuery<Artist>({
    queryKey: ['admin', 'artist', id],
    queryFn: () => adminFetch<Artist>('admin-artists', { params: { artist_id: id! } }),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useUpdateArtist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: Partial<Artist> & { id: string }) =>
      adminFetch('admin-artists', { method: 'PUT', body: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'artist'] })
    },
  })
}

export function useUpdateAndRefetch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ artistId, updates }: { artistId: string; updates: Partial<Artist> }) =>
      adminFetch<{ data: Artist; refetched: string[] }>('admin-artists', {
        method: 'POST',
        body: { action: 'update_and_refetch', artist_id: artistId, updates },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'artist'] })
    },
  })
}

export function useBulkUpdateArtists() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ artistIds, updates }: { artistIds: string[]; updates: Partial<Artist> }) =>
      adminFetch('admin-artists', {
        method: 'POST',
        body: { action: 'bulk_update', artist_ids: artistIds, updates },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
    },
  })
}

export function useActivateBio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ artistId, source }: { artistId: string; source: string }) =>
      adminFetch('admin-artists', {
        method: 'POST',
        body: { action: 'activate_bio', artist_id: artistId, source },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'artist'] })
    },
  })
}
