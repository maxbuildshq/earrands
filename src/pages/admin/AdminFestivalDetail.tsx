import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Badge } from '../../components/ui/Badge'
import { useAdminFestival, useUpdateFestival, useToggleFestivalField, useUpdateStage } from '../../hooks/useAdminFestivals'
import { useStages, useSets } from '../../hooks/useFestivalData'
import { useSendNotification } from '../../hooks/useAdminNotifications'
import { useCreateJob } from '../../hooks/useAdminJobs'
import { SetArtistCompare } from '../../components/admin/SetArtistCompare'

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function InlineStageName({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  function commit() {
    if (draft.trim() && draft !== name) onSave(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className="bg-transparent border-b border-accent text-accent font-mono text-sm outline-none"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(name); setEditing(false) }
        }}
        autoFocus
      />
    )
  }

  return (
    <span
      className="text-text-primary cursor-pointer hover:text-accent"
      onClick={() => { setDraft(name); setEditing(true) }}
      title="Click to rename"
    >
      {name}
    </span>
  )
}

export default function AdminFestivalDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: festival, isLoading } = useAdminFestival(id)
  const { data: stages = [] } = useStages(festival?.id)
  const { data: sets = [] } = useSets(festival?.id)
  const update = useUpdateFestival()
  const toggle = useToggleFestivalField()
  const updateStage = useUpdateStage()
  const notify = useSendNotification()
  const createJob = useCreateJob()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', location: '', start_date: '', end_date: '' })
  const [notifyResult, setNotifyResult] = useState<string | null>(null)

  useEffect(() => {
    if (festival) {
      setForm({
        name: festival.name,
        slug: festival.slug,
        location: festival.location ?? '',
        start_date: festival.start_date,
        end_date: festival.end_date,
      })
    }
  }, [festival])

  if (isLoading || !festival) {
    return (
      <div className="space-y-8">
        <Heading variant="page">Loading...</Heading>
      </div>
    )
  }

  // Distinct parsed artists (matches the Sets ↔ Artists table), not unique raw set strings
  const uniqueArtists = new Set(sets.flatMap(s => (s.set_artists ?? []).map(sa => sa.artists.name)))
  const days = [...new Set(sets.map(s => s.day))].sort()

  function handleSave() {
    if (!festival) return
    update.mutate({ id: festival.id, ...form }, { onSuccess: () => setEditing(false) })
  }

  function handleNotifyPreview() {
    if (!festival) return
    notify.mutate(
      { type: 'follow', festival_id: festival.id, festival_slug: festival.slug, dry_run: true },
      { onSuccess: (r) => setNotifyResult(r.message ?? `Preview: ${r.recipients} recipients — ${r.emails?.join(', ')}`) },
    )
  }

  function handleNotifySend() {
    if (!festival) return
    notify.mutate(
      { type: 'follow', festival_id: festival.id, festival_slug: festival.slug },
      { onSuccess: (r) => setNotifyResult(r.message ?? `Sent: ${r.sent}/${r.total}`) },
    )
  }

  function handleParseArtists() {
    if (!festival) return
    createJob.mutate({ type: 'parse_artists', festival_slug: festival.slug })
  }

  function handleEnrich() {
    if (!festival) return
    createJob.mutate({ type: 'enrich', festival_slug: festival.slug })
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center gap-4">
        <Link to="/admin/festivals" className="font-mono text-xs text-text-secondary hover:text-accent transition-colors uppercase tracking-wider">
          &larr; Festivals
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <Heading variant="page">{festival.name}</Heading>
        <div className="flex gap-2 shrink-0">
          <Button
            variant={festival.published ? 'primary' : 'secondary'}
            fullWidth={false}
            onClick={() => toggle.mutate({ id: festival.id, field: 'published', value: !festival.published })}
          >
            {festival.published ? 'Published' : 'Draft'}
          </Button>
          <Button
            variant={festival.timetable_announced ? 'primary' : 'secondary'}
            fullWidth={false}
            onClick={() => toggle.mutate({ id: festival.id, field: 'timetable_announced', value: !festival.timetable_announced })}
          >
            {festival.timetable_announced ? 'Timetable Live' : 'Lineup Only'}
          </Button>
        </div>
      </div>

      {/* Pipeline actions */}
      <section className="border border-border p-6 space-y-4">
        <Heading variant="section">Pipeline Actions</Heading>
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary" fullWidth={false} onClick={handleParseArtists} disabled={createJob.isPending}>
            Parse Artists
          </Button>
          <Button variant="secondary" fullWidth={false} onClick={handleEnrich} disabled={createJob.isPending}>
            Enrich Artists
          </Button>
          <Button variant="secondary" fullWidth={false} onClick={handleNotifyPreview} disabled={notify.isPending}>
            Preview Notify
          </Button>
          <Button variant="primary" fullWidth={false} onClick={handleNotifySend} disabled={notify.isPending}>
            Send Notifications
          </Button>
        </div>
        {createJob.isSuccess && (
          <p className="font-mono text-xs text-accent">Job created — check Jobs page for status.</p>
        )}
        {notifyResult && (
          <p className="font-mono text-xs text-accent">{notifyResult}</p>
        )}
      </section>

      {/* Info section */}
      <section className="border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Heading variant="section">Festival Info</Heading>
          {!editing && (
            <Button variant="secondary" fullWidth={false} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4 max-w-lg">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" fullWidth={false} onClick={handleSave} disabled={update.isPending}>
                {update.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" fullWidth={false} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 font-mono text-sm">
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Slug</span>
              <p className="text-text-primary">{festival.slug}</p>
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Location</span>
              <p className="text-text-primary">{festival.location ?? '—'}</p>
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Dates</span>
              <p className="text-text-primary">{formatDate(festival.start_date)} — {formatDate(festival.end_date)}</p>
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Created</span>
              <p className="text-text-primary">{formatDate(festival.created_at.split('T')[0])}</p>
            </div>
          </div>
        )}
      </section>

      {/* Stats section */}
      <section className="border border-border p-6 space-y-4">
        <Heading variant="section">Content</Heading>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <span className="font-mono text-2xl font-bold text-accent">{stages.length}</span>
            <p className="font-mono text-xs text-text-secondary uppercase tracking-wider mt-1">Stages</p>
          </div>
          <div>
            <span className="font-mono text-2xl font-bold text-accent">{sets.length}</span>
            <p className="font-mono text-xs text-text-secondary uppercase tracking-wider mt-1">Sets</p>
          </div>
          <div>
            <span className="font-mono text-2xl font-bold text-accent">{uniqueArtists.size}</span>
            <p className="font-mono text-xs text-text-secondary uppercase tracking-wider mt-1">Artists</p>
          </div>
          <div>
            <span className="font-mono text-2xl font-bold text-accent">{days.length}</span>
            <p className="font-mono text-xs text-text-secondary uppercase tracking-wider mt-1">Days</p>
          </div>
        </div>
      </section>

      {/* Stages list */}
      <section className="border border-border p-6 space-y-4">
        <Heading variant="section">Stages</Heading>
        {stages.length === 0 ? (
          <p className="font-mono text-sm text-text-secondary">No stages.</p>
        ) : (
          <div className="space-y-1">
            {stages.map(stage => (
              <div key={stage.id} className="flex items-center gap-3 font-mono text-sm py-1.5">
                <Badge variant="accent-outline">{stage.sort_order}</Badge>
                <InlineStageName
                  name={stage.name}
                  onSave={name => updateStage.mutate({ stageId: stage.id, name })}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sets vs parsed artists comparison */}
      <section className="border border-border p-6 space-y-4">
        <Heading variant="section">Sets ↔ Artists</Heading>
        <SetArtistCompare sets={sets} stages={stages} />
      </section>
    </div>
  )
}
