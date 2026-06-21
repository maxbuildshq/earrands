import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/admin'
import type { NotificationLog } from '../types/database'

export function useNotificationLog() {
  return useQuery<NotificationLog[]>({
    queryKey: ['admin', 'notification-log'],
    queryFn: () => adminFetch<NotificationLog[]>('admin-notify'),
    staleTime: 30_000,
  })
}

type SendNotifyParams = {
  type: 'follow' | 'request'
  festival_id: string
  festival_slug?: string
  request_ids?: string[]
  dry_run?: boolean
}

type SendResult = {
  sent?: number
  failed?: number
  total?: number
  dry_run?: boolean
  recipients?: number
  emails?: string[]
  subject?: string
  html?: string
  message?: string
}

export function useSendNotification() {
  const queryClient = useQueryClient()
  return useMutation<SendResult, Error, SendNotifyParams>({
    mutationFn: (params) =>
      adminFetch<SendResult>('admin-notify', { method: 'POST', body: params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notification-log'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'requests'] })
    },
  })
}
