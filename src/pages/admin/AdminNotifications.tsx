import { useState } from 'react'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useNotificationLog, useSendNotification } from '../../hooks/useAdminNotifications'
import { useAdminFestivals } from '../../hooks/useAdminFestivals'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminNotifications() {
  const { data: log = [], isLoading } = useNotificationLog()
  const { data: festivals = [] } = useAdminFestivals()
  const send = useSendNotification()

  const [selectedFestival, setSelectedFestival] = useState('')
  const [lastResult, setLastResult] = useState<string | null>(null)

  const festivalMap = new Map(festivals.map(f => [f.id, f]))

  function handlePreview() {
    if (!selectedFestival) return
    const f = festivalMap.get(selectedFestival)
    send.mutate(
      { type: 'follow', festival_id: selectedFestival, festival_slug: f?.slug, dry_run: true },
      { onSuccess: (r) => setLastResult(r.message ?? `Preview: ${r.recipients} recipients — ${r.emails?.join(', ')}`) },
    )
  }

  function handleSend() {
    if (!selectedFestival) return
    const f = festivalMap.get(selectedFestival)
    send.mutate(
      { type: 'follow', festival_id: selectedFestival, festival_slug: f?.slug },
      { onSuccess: (r) => setLastResult(r.message ?? `Sent: ${r.sent}/${r.total}${r.failed ? ` (${r.failed} failed)` : ''}`) },
    )
  }

  return (
    <div className="space-y-6">
      <Heading variant="page">Notifications</Heading>

      {/* Send timetable-drop notification */}
      <div className="border border-border p-4 space-y-3">
        <Heading variant="section">Notify Followers (Timetable Drop)</Heading>
        <div className="flex items-end gap-4">
          <div>
            <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-1">Festival</span>
            <select
              value={selectedFestival}
              onChange={e => setSelectedFestival(e.target.value)}
              className="bg-surface border border-border text-text-primary font-mono text-sm px-3 py-2 uppercase tracking-wider"
            >
              <option value="">Select festival...</option>
              {festivals.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <Button variant="secondary" fullWidth={false} onClick={handlePreview} disabled={!selectedFestival || send.isPending}>
            Preview
          </Button>
          <Button variant="primary" fullWidth={false} onClick={handleSend} disabled={!selectedFestival || send.isPending}>
            Send
          </Button>
        </div>
        {lastResult && (
          <p className="font-mono text-xs text-accent">{lastResult}</p>
        )}
      </div>

      {/* Notification history */}
      <Heading variant="section">History</Heading>
      <div className="border border-border">
        <div className="grid grid-cols-[1fr_120px_80px_80px_160px] gap-2 px-4 py-2.5 border-b border-border font-mono text-xs uppercase tracking-widest text-text-secondary">
          <span>Type</span>
          <span>Festival</span>
          <span>Recipients</span>
          <span>Status</span>
          <span>Sent At</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-center font-mono text-sm text-text-secondary">Loading...</div>
        ) : log.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-sm text-text-secondary">No notifications sent yet.</div>
        ) : (
          log.map(entry => (
            <div key={entry.id} className="grid grid-cols-[1fr_120px_80px_80px_160px] gap-2 px-4 py-3.5 border-b border-border last:border-b-0 items-center">
              <span className="font-mono text-sm text-text-primary">{entry.type.replace('_', ' ')}</span>
              <span className="font-mono text-sm text-text-secondary truncate">
                {entry.festival_id ? festivalMap.get(entry.festival_id)?.name ?? '—' : '—'}
              </span>
              <span className="font-mono text-sm text-accent font-bold">{entry.recipient_count}</span>
              <div>
                {entry.success
                  ? <Badge variant="accent">OK</Badge>
                  : <Badge variant="outline">{entry.error ?? 'Failed'}</Badge>
                }
              </div>
              <span className="font-mono text-sm text-text-secondary">{formatDate(entry.sent_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
