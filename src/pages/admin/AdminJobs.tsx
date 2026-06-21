import { useState } from 'react'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { useAdminJobs, useCreateJob, useJobAction } from '../../hooks/useAdminJobs'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE: Record<string, 'accent' | 'accent-outline' | 'outline' | 'live'> = {
  pending: 'outline',
  running: 'live',
  completed: 'accent',
  failed: 'accent-outline',
}

export default function AdminJobs() {
  const { data: jobs = [], isLoading } = useAdminJobs()
  const create = useCreateJob()
  const action = useJobAction()

  const [newType, setNewType] = useState('enrich')
  const [newSlug, setNewSlug] = useState('')
  const [newFields, setNewFields] = useState('')

  function handleCreate() {
    create.mutate({
      type: newType,
      festival_slug: newSlug || undefined,
      fields: newFields ? newFields.split(',').map(s => s.trim()) : undefined,
    }, {
      onSuccess: () => { setNewSlug(''); setNewFields('') },
    })
  }

  return (
    <div className="space-y-6">
      <Heading variant="page">Background Jobs</Heading>

      {/* Create job */}
      <div className="border border-border p-4 space-y-3">
        <Heading variant="section">Create Job</Heading>
        <div className="flex items-end gap-4">
          <div>
            <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-1">Type</span>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="bg-surface border border-border text-text-primary font-mono text-sm px-3 py-2 uppercase tracking-wider"
            >
              <option value="enrich">Enrich</option>
              <option value="parse_artists">Parse Artists</option>
              <option value="bio_research">Bio Research</option>
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-1">Festival Slug</span>
            <Input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="e.g. dekmantel-2026" />
          </div>
          <div className="max-w-xs">
            <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-1">Fields</span>
            <Input value={newFields} onChange={e => setNewFields(e.target.value)} placeholder="e.g. bio,bandcamp" />
          </div>
          <Button variant="primary" fullWidth={false} onClick={handleCreate} disabled={create.isPending}>
            Create
          </Button>
        </div>
      </div>

      {/* Jobs table */}
      <div className="border border-border">
        <div className="grid grid-cols-[100px_120px_1fr_80px_120px_120px_100px] gap-2 px-4 py-2.5 border-b border-border font-mono text-xs uppercase tracking-widest text-text-secondary">
          <span>Type</span>
          <span>Status</span>
          <span>Target</span>
          <span>Fields</span>
          <span>Created</span>
          <span>Duration</span>
          <span>Actions</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-center font-mono text-sm text-text-secondary">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-sm text-text-secondary">No jobs yet.</div>
        ) : (
          jobs.map(job => {
            const target = job.festival_slug
              ?? (job.artist_sort_names?.length ? `${job.artist_sort_names.length} artists` : '—')
            const duration = job.started_at && job.completed_at
              ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
              : job.started_at ? 'Running...' : '—'

            return (
              <div key={job.id} className="grid grid-cols-[100px_120px_1fr_80px_120px_120px_100px] gap-2 px-4 py-3.5 border-b border-border last:border-b-0 items-center">
                <span className="font-mono text-sm text-text-primary">{job.type}</span>
                <Badge variant={STATUS_BADGE[job.status] ?? 'outline'}>{job.status}</Badge>
                <span className="font-mono text-sm text-text-secondary truncate">{target}</span>
                <span className="font-mono text-xs text-text-secondary">{job.fields?.join(', ') ?? '—'}</span>
                <span className="font-mono text-sm text-text-secondary">{formatDate(job.created_at)}</span>
                <span className="font-mono text-sm text-text-secondary">{duration}</span>
                <div className="flex gap-1">
                  {(job.status === 'pending' || job.status === 'running') && (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      className="!text-xs !px-3 !py-1"
                      onClick={() => action.mutate({ id: job.id, action: 'cancel' })}
                      disabled={action.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                  {job.status === 'failed' && (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      className="!text-xs !px-3 !py-1"
                      onClick={() => action.mutate({ id: job.id, action: 'retry' })}
                      disabled={action.isPending}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Error details */}
      {jobs.some(j => j.error) && (
        <div className="space-y-2">
          <Heading variant="section">Errors</Heading>
          {jobs.filter(j => j.error).map(j => (
            <div key={j.id} className="border border-border p-3">
              <span className="font-mono text-xs text-text-secondary">{j.type} — {formatDate(j.created_at)}</span>
              <p className="font-mono text-xs text-negative mt-1">{j.error}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
