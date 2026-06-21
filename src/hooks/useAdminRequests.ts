import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/admin'
import type { FestivalRequest } from '../types/database'

type RequestWithEmail = FestivalRequest & {
  user_email: string | null
  matched_festival_name: string | null
}

export function useAdminRequests() {
  return useQuery<RequestWithEmail[]>({
    queryKey: ['admin', 'requests'],
    queryFn: () => adminFetch<RequestWithEmail[]>('admin-requests'),
    staleTime: 30_000,
  })
}

export function useMapRequestToFestival() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, festivalId }: { requestId: string; festivalId: string | null }) =>
      adminFetch('admin-requests', { method: 'PATCH', body: { request_id: requestId, festival_id: festivalId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'requests'] })
    },
  })
}
