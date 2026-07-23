import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/admin'
import type { Artist } from '../types/database'

type ArtistListResponse = { data: Artist[]; count: number }

// ── Optimistic-update cache helpers (Item 6) ─────────────────────────────────
// Admin artist mutations go through slow edge functions; patching the React
// Query cache in onMutate makes the UI respond instantly, with onError rollback
// and onSettled reconcile so nothing is left unsaved. Mirrors useToggleFestivalField.

type ArtistCacheSnapshot = {
  lists: Array<[readonly unknown[], ArtistListResponse | undefined]>
  details: Array<[readonly unknown[], Artist | undefined]>
}

function snapshotArtistCaches(qc: QueryClient): ArtistCacheSnapshot {
  return {
    lists: qc.getQueriesData<ArtistListResponse>({ queryKey: ['admin', 'artists'] }),
    details: qc.getQueriesData<Artist>({ queryKey: ['admin', 'artist'] }),
  }
}

function restoreArtistCaches(qc: QueryClient, snap: ArtistCacheSnapshot) {
  snap.lists.forEach(([key, val]) => qc.setQueryData(key, val))
  snap.details.forEach(([key, val]) => qc.setQueryData(key, val))
}

// Merge a partial patch into one artist across every cached list + its detail query.
function patchArtistInCaches(qc: QueryClient, id: string, patch: Partial<Artist>) {
  qc.getQueriesData<ArtistListResponse>({ queryKey: ['admin', 'artists'] }).forEach(([key, val]) => {
    if (!val) return
    qc.setQueryData<ArtistListResponse>(key, {
      ...val,
      data: val.data.map(a => (a.id === id ? { ...a, ...patch } : a)),
    })
  })
  qc.setQueryData<Artist>(['admin', 'artist', id], prev => (prev ? { ...prev, ...patch } : prev))
}

async function cancelArtistQueries(qc: QueryClient) {
  await qc.cancelQueries({ queryKey: ['admin', 'artists'] })
  await qc.cancelQueries({ queryKey: ['admin', 'artist'] })
}

type ArtistFilters = {
  festivalId?: string
  status?: string
  search?: string
  limit?: number
  offset?: number
  hasCandidates?: boolean
}

export function useAdminArtists(filters: ArtistFilters = {}) {
  const params: Record<string, string> = {}
  if (filters.festivalId) params.festival_id = filters.festivalId
  if (filters.status) params.status = filters.status
  if (filters.search) params.search = filters.search
  if (filters.limit) params.limit = String(filters.limit)
  if (filters.offset) params.offset = String(filters.offset)
  if (filters.hasCandidates) params.has_candidates = '1'

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
    onMutate: async (updates) => {
      await cancelArtistQueries(queryClient)
      const snap = snapshotArtistCaches(queryClient)
      const { id, ...patch } = updates
      patchArtistInCaches(queryClient, id, patch as Partial<Artist>)
      return { snap }
    },
    onError: (err, _vars, context) => {
      // Failed save reverts visibly (optimistic rollback) rather than silently sticking
      console.error('Artist update failed — reverting:', err)
      if (context?.snap) restoreArtistCaches(queryClient, context.snap)
    },
    onSettled: () => {
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
    onMutate: async ({ artistId, updates }) => {
      await cancelArtistQueries(queryClient)
      const snap = snapshotArtistCaches(queryClient)
      // Server may additionally refetch SC-derived fields; onSettled reconciles those.
      patchArtistInCaches(queryClient, artistId, updates)
      return { snap }
    },
    onError: (err, _vars, context) => {
      console.error('Artist update failed — reverting:', err)
      if (context?.snap) restoreArtistCaches(queryClient, context.snap)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'artist'] })
    },
  })
}

// Wipe all machine-enriched fields for a junk artist in one shot (bio kept).
// Server-side `clean` action does the authoritative wipe; we optimistically null
// the same fields so the card blanks instantly.
const CLEANED_PATCH: Partial<Artist> = {
  image_url: null,
  image_candidates: null,
  instagram_url: null,
  soundcloud_url: null,
  soundcloud_embed_url: null,
  bandcamp_url: null,
  discogs_id: null,
  city: null,
  country_code: null,
  soundcloud_followers: null,
  enrichment_status: 'pending',
}

export function useCleanArtist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ artistId }: { artistId: string }) =>
      adminFetch<{ data: Artist }>('admin-artists', {
        method: 'POST',
        body: { action: 'clean', artist_id: artistId },
      }),
    onMutate: async ({ artistId }) => {
      await cancelArtistQueries(queryClient)
      const snap = snapshotArtistCaches(queryClient)
      patchArtistInCaches(queryClient, artistId, CLEANED_PATCH)
      return { snap }
    },
    onError: (err, _vars, context) => {
      console.error('Clean artist failed — reverting:', err)
      if (context?.snap) restoreArtistCaches(queryClient, context.snap)
    },
    onSettled: () => {
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

// Approve whole artists: status → reviewed + all populated fields upgraded to
// high confidence with an admin-approved stamp (server-side, see admin-artists)
export function useApproveArtists() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ artistIds }: { artistIds: string[] }) =>
      adminFetch<{ count: number }>('admin-artists', {
        method: 'POST',
        body: { action: 'approve', artist_ids: artistIds },
      }),
    onMutate: async ({ artistIds }) => {
      await cancelArtistQueries(queryClient)
      const snap = snapshotArtistCaches(queryClient)
      const ids = new Set(artistIds)
      // In pending/flagged lists an approved artist leaves the list (removed from
      // cache synchronously) — this is what makes the review keyboard focus land
      // on the next artist. Elsewhere just flip its status to reviewed.
      queryClient.getQueriesData<ArtistListResponse>({ queryKey: ['admin', 'artists'] }).forEach(([key, val]) => {
        if (!val) return
        const params = key[2] as Record<string, string> | undefined
        const leavesList = params?.status === 'pending' || params?.status === 'flagged'
        if (leavesList) {
          const kept = val.data.filter(a => !ids.has(a.id))
          queryClient.setQueryData<ArtistListResponse>(key, {
            data: kept,
            count: Math.max(0, val.count - (val.data.length - kept.length)),
          })
        } else {
          queryClient.setQueryData<ArtistListResponse>(key, {
            ...val,
            data: val.data.map(a => (ids.has(a.id) ? { ...a, enrichment_status: 'reviewed' } : a)),
          })
        }
      })
      artistIds.forEach(id =>
        queryClient.setQueryData<Artist>(['admin', 'artist', id], prev =>
          prev ? { ...prev, enrichment_status: 'reviewed' } : prev,
        ),
      )
      return { snap }
    },
    onError: (err, _vars, context) => {
      console.error('Approve failed — reverting:', err)
      if (context?.snap) restoreArtistCaches(queryClient, context.snap)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'artist'] })
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
    onMutate: async ({ artistId, source }) => {
      await cancelArtistQueries(queryClient)
      const snap = snapshotArtistCaches(queryClient)
      // Read the target version from cache to preview the activation locally
      let artist: Artist | undefined
      for (const [, val] of queryClient.getQueriesData<ArtistListResponse>({ queryKey: ['admin', 'artists'] })) {
        artist = val?.data.find(a => a.id === artistId)
        if (artist) break
      }
      if (!artist) artist = queryClient.getQueryData<Artist>(['admin', 'artist', artistId])
      if (artist) {
        const newBio = source === 'festival' ? artist.bio_festival : source === 'generated' ? artist.bio_generated : artist.bio
        patchArtistInCaches(queryClient, artistId, { bio: newBio, bio_source: source })
      }
      return { snap }
    },
    onError: (err, _vars, context) => {
      console.error('Activate bio failed — reverting:', err)
      if (context?.snap) restoreArtistCaches(queryClient, context.snap)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'artists'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'artist'] })
    },
  })
}
