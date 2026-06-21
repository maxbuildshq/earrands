import { useState } from 'react'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useAdminRequests, useMapRequestToFestival } from '../../hooks/useAdminRequests'
import { useAdminFestivals } from '../../hooks/useAdminFestivals'
import { useSendNotification } from '../../hooks/useAdminNotifications'

export default function AdminRequests() {
  const { data: requests = [], isLoading } = useAdminRequests()
  const { data: festivals = [] } = useAdminFestivals()
  const send = useSendNotification()
  const mapRequest = useMapRequestToFestival()

  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [matchFestivalId, setMatchFestivalId] = useState('')
  const [lastResult, setLastResult] = useState<string | null>(null)

  const pending = requests.filter(r => !r.notified_at)
  const notified = requests.filter(r => r.notified_at)

  const matchedFestival = festivals.find(f => f.id === matchFestivalId)

  function toggleRequest(id: string) {
    setSelectedRequests(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllPending() {
    setSelectedRequests(new Set(pending.map(r => r.id)))
  }

  function handleMapSelected() {
    if (!matchFestivalId || selectedRequests.size === 0) return
    for (const reqId of selectedRequests) {
      mapRequest.mutate({ requestId: reqId, festivalId: matchFestivalId })
    }
  }

  function handleMapOne(requestId: string, festivalId: string) {
    mapRequest.mutate({ requestId, festivalId: festivalId || null })
  }

  function handlePreview() {
    if (!matchFestivalId || selectedRequests.size === 0) return
    send.mutate(
      { type: 'request', festival_id: matchFestivalId, festival_slug: matchedFestival?.slug, request_ids: [...selectedRequests], dry_run: true },
      { onSuccess: (r) => setLastResult(`Preview: ${r.recipients} recipients — ${r.emails?.join(', ')}`) },
    )
  }

  function handleSend() {
    if (!matchFestivalId || selectedRequests.size === 0) return
    send.mutate(
      { type: 'request', festival_id: matchFestivalId, festival_slug: matchedFestival?.slug, request_ids: [...selectedRequests] },
      {
        onSuccess: (r) => {
          setLastResult(`Sent: ${r.sent}/${r.total}${r.failed ? ` (${r.failed} failed)` : ''}`)
          setSelectedRequests(new Set())
        },
      },
    )
  }

  const canAct = matchFestivalId && selectedRequests.size > 0

  return (
    <div className="space-y-6">
      <Heading variant="page">Festival Requests</Heading>

      {/* Pending requests table */}
      <div className="border border-border">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="font-mono text-xs uppercase tracking-widest text-text-secondary">
            {pending.length} pending
          </span>
          {pending.length > 0 && (
            <button
              className="font-mono text-xs text-accent hover:underline uppercase tracking-wider"
              onClick={selectAllPending}
            >
              Select all
            </button>
          )}
        </div>

        <div className="grid grid-cols-[32px_1fr_100px_160px_160px_80px] gap-2 px-4 py-2 border-b border-border font-mono text-xs uppercase tracking-widest text-text-secondary">
          <span></span>
          <span>Requested Name</span>
          <span>Region</span>
          <span>Email</span>
          <span>Mapped To</span>
          <span>Status</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-center font-mono text-sm text-text-secondary">Loading...</div>
        ) : pending.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-sm text-text-secondary">No pending requests.</div>
        ) : (
          pending.map(r => (
            <div
              key={r.id}
              className={`grid grid-cols-[32px_1fr_100px_160px_160px_80px] gap-2 px-4 py-3.5 border-b border-border last:border-b-0 items-center transition-colors cursor-pointer ${
                selectedRequests.has(r.id) ? 'bg-surface-raised' : 'hover:bg-surface-raised'
              }`}
              onClick={() => toggleRequest(r.id)}
            >
              <input
                type="checkbox"
                checked={selectedRequests.has(r.id)}
                onChange={() => toggleRequest(r.id)}
                onClick={e => e.stopPropagation()}
                className="accent-accent"
              />
              <span className="font-mono text-sm text-text-primary font-bold">{r.raw_name}</span>
              <span className="font-mono text-sm text-text-secondary">{r.region ?? '—'}</span>
              <span className="font-mono text-sm text-text-secondary truncate">{r.user_email ?? '—'}</span>
              <div onClick={e => e.stopPropagation()}>
                <select
                  value={r.matched_festival_id ?? ''}
                  onChange={e => handleMapOne(r.id, e.target.value)}
                  className="bg-surface border border-border text-text-primary font-mono text-xs px-2 py-1 w-full uppercase tracking-wider"
                >
                  <option value="">—</option>
                  {festivals.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <Badge variant={r.matched_festival_id ? 'accent-outline' : 'outline'}>
                {r.matched_festival_id ? 'Mapped' : 'Pending'}
              </Badge>
            </div>
          ))
        )}
      </div>

      {/* Bulk actions */}
      {pending.length > 0 && (
        <div className={`border p-4 space-y-3 ${canAct ? 'border-accent' : 'border-border'}`}>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-mono text-sm text-text-primary font-bold">
              {selectedRequests.size} selected
            </span>
            <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">→ match to:</span>
            <select
              value={matchFestivalId}
              onChange={e => setMatchFestivalId(e.target.value)}
              className="bg-surface border border-border text-text-primary font-mono text-sm px-3 py-2 uppercase tracking-wider"
            >
              <option value="">Select festival...</option>
              {festivals.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <Button variant="secondary" fullWidth={false} onClick={handleMapSelected} disabled={!canAct || mapRequest.isPending}>
              Map
            </Button>
            <Button variant="secondary" fullWidth={false} onClick={handlePreview} disabled={!canAct || send.isPending}>
              Preview
            </Button>
            <Button variant="primary" fullWidth={false} onClick={handleSend} disabled={!canAct || send.isPending}>
              Send
            </Button>
          </div>
          {!canAct && selectedRequests.size > 0 && !matchFestivalId && (
            <p className="font-mono text-xs text-text-secondary">Select a festival to match these requests to.</p>
          )}
          {!canAct && selectedRequests.size === 0 && (
            <p className="font-mono text-xs text-text-secondary">Select one or more requests above, then pick a festival.</p>
          )}
          {lastResult && (
            <p className="font-mono text-xs text-accent">{lastResult}</p>
          )}
        </div>
      )}

      {/* Notified requests */}
      {notified.length > 0 && (
        <>
          <Heading variant="section">Previously Notified</Heading>
          <div className="border border-border">
            {notified.map(r => (
              <div key={r.id} className="grid grid-cols-[1fr_100px_160px_160px_80px] gap-2 px-4 py-3.5 border-b border-border last:border-b-0 items-center">
                <span className="font-mono text-sm text-text-secondary">{r.raw_name}</span>
                <span className="font-mono text-sm text-text-secondary">{r.region ?? '—'}</span>
                <span className="font-mono text-sm text-text-secondary truncate">{r.user_email ?? '—'}</span>
                <span className="font-mono text-sm text-accent truncate">{r.matched_festival_name ?? '—'}</span>
                <Badge variant="accent">Notified</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
