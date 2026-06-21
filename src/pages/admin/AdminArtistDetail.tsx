import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { EnrichmentStatusBadge } from '../../components/admin/EnrichmentStatusBadge'
import { SourceLabel } from '../../components/admin/SourceLabel'
import { useAdminArtist, useUpdateArtist, useUpdateAndRefetch, useActivateBio } from '../../hooks/useAdminArtists'
import { useCreateJob } from '../../hooks/useAdminJobs'
import type { Artist } from '../../types/database'

function ExternalLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="font-mono text-xs text-border">—</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-accent hover:underline truncate block max-w-xs"
    >
      {label}
    </a>
  )
}

type EditForm = {
  name: string
  soundcloud_url: string
  instagram_url: string
  bandcamp_url: string
  image_url: string
  city: string
  country_code: string
}

export default function AdminArtistDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: artist, isLoading } = useAdminArtist(id)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm>({
    name: '', soundcloud_url: '', instagram_url: '', bandcamp_url: '',
    image_url: '', city: '', country_code: '',
  })

  const update = useUpdateArtist()
  const updateAndRefetch = useUpdateAndRefetch()
  const activateBio = useActivateBio()
  const createJob = useCreateJob()

  useEffect(() => {
    if (artist) {
      setForm({
        name: artist.name,
        soundcloud_url: artist.soundcloud_url ?? '',
        instagram_url: artist.instagram_url ?? '',
        bandcamp_url: artist.bandcamp_url ?? '',
        image_url: artist.image_url ?? '',
        city: artist.city ?? '',
        country_code: artist.country_code ?? '',
      })
    }
  }, [artist])

  if (isLoading || !artist) {
    return (
      <div className="space-y-8">
        <Heading variant="page">Loading...</Heading>
      </div>
    )
  }

  const scUrlChanged = form.soundcloud_url !== (artist.soundcloud_url ?? '')

  function handleSave() {
    if (scUrlChanged && form.soundcloud_url) {
      updateAndRefetch.mutate(
        { artistId: artist!.id, updates: formToUpdates() },
        { onSuccess: () => setEditing(false) },
      )
    } else {
      update.mutate(
        { id: artist!.id, ...formToUpdates() },
        { onSuccess: () => setEditing(false) },
      )
    }
  }

  function formToUpdates(): Partial<Artist> {
    return {
      name: form.name,
      soundcloud_url: form.soundcloud_url || null,
      instagram_url: form.instagram_url || null,
      bandcamp_url: form.bandcamp_url || null,
      image_url: form.image_url || null,
      city: form.city || null,
      country_code: form.country_code || null,
    } as Partial<Artist>
  }

  function handleStatusChange(newStatus: string) {
    update.mutate({
      id: artist!.id,
      enrichment_status: newStatus,
      ...(newStatus === 'reviewed' ? { enriched_at: new Date().toISOString() } : {}),
    } as Partial<Artist> & { id: string })
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link to="/admin/artists" className="font-mono text-xs text-text-secondary hover:text-accent transition-colors uppercase tracking-wider">
          &larr; Artists
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {artist.image_url ? (
            <img src={artist.image_url} alt="" className="w-16 h-16 object-cover" />
          ) : (
            <div className="w-16 h-16 bg-surface-raised border border-border" />
          )}
          <div>
            <Heading variant="page">{artist.name}</Heading>
            <div className="flex items-center gap-2 mt-1">
              <EnrichmentStatusBadge status={artist.enrichment_status} />
              {artist.city && (
                <span className="font-mono text-xs text-text-secondary">
                  {[artist.city, artist.country_code].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button
            variant="primary"
            fullWidth={false}
            onClick={() => handleStatusChange('reviewed')}
            disabled={artist.enrichment_status === 'reviewed'}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => handleStatusChange('pending')}
            disabled={artist.enrichment_status === 'pending'}
          >
            Reset
          </Button>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => createJob.mutate({ type: 'enrich', artist_sort_names: [artist.sort_name] })}
            disabled={createJob.isPending}
          >
            Enrich
          </Button>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => createJob.mutate({ type: 'enrich', artist_sort_names: [artist.sort_name], fields: ['bio'] })}
            disabled={createJob.isPending}
          >
            Bio Research
          </Button>
        </div>
      </div>

      {/* Links & Fields */}
      <section className="border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Heading variant="section">Profile & Links</Heading>
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
              <Label htmlFor="sc">SoundCloud URL</Label>
              <Input id="sc" value={form.soundcloud_url} onChange={e => setForm(f => ({ ...f, soundcloud_url: e.target.value }))} />
              {scUrlChanged && (
                <p className="font-mono text-[10px] text-accent mt-1 uppercase tracking-wider">
                  SC URL changed — dependent fields will be refetched on save
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="ig">Instagram URL</Label>
              <Input id="ig" value={form.instagram_url} onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="bc">Bandcamp URL</Label>
              <Input id="bc" value={form.bandcamp_url} onChange={e => setForm(f => ({ ...f, bandcamp_url: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="img">Image URL</Label>
              <Input id="img" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cc">Country Code</Label>
                <Input id="cc" value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" fullWidth={false} onClick={handleSave} disabled={update.isPending || updateAndRefetch.isPending}>
                {(update.isPending || updateAndRefetch.isPending) ? 'Saving...' : scUrlChanged ? 'Save & Refetch' : 'Save'}
              </Button>
              <Button variant="secondary" fullWidth={false} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 font-mono text-sm">
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">SoundCloud</span>
              <ExternalLink href={artist.soundcloud_url} label={artist.soundcloud_url?.replace('https://soundcloud.com/', '') ?? ''} />
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Instagram</span>
              <ExternalLink href={artist.instagram_url} label={artist.instagram_url?.replace('https://www.instagram.com/', '@') ?? ''} />
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Bandcamp</span>
              <ExternalLink href={artist.bandcamp_url} label={artist.bandcamp_url?.replace('https://', '')?.replace('.bandcamp.com', '') ?? ''} />
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Image</span>
              <ExternalLink href={artist.image_url} label="View" />
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Location</span>
              <p className="text-text-primary">{[artist.city, artist.country_code].filter(Boolean).join(', ') || '—'}</p>
            </div>
            <div>
              <span className="text-text-secondary text-xs uppercase tracking-wider">Discogs ID</span>
              <p className="text-text-primary">{artist.discogs_id ?? '—'}</p>
            </div>
          </div>
        )}
      </section>

      {/* Bio Comparison */}
      <section className="border border-border p-6 space-y-4">
        <Heading variant="section">Bio</Heading>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">Active source:</span>
          <SourceLabel source={artist.bio_source} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BioCard title="Active Bio" content={artist.bio} isActive />
          <BioCard
            title="Festival Bio"
            content={artist.bio_festival}
            onActivate={artist.bio_festival ? () => activateBio.mutate({ artistId: artist.id, source: 'festival' }) : undefined}
            isActive={artist.bio_source === 'festival'}
          />
          <BioCard
            title="Generated Bio"
            content={artist.bio_generated}
            onActivate={artist.bio_generated ? () => activateBio.mutate({ artistId: artist.id, source: 'generated' }) : undefined}
            isActive={artist.bio_source === 'generated'}
          />
        </div>
      </section>

      {/* Metadata */}
      <section className="border border-border p-6 space-y-4">
        <Heading variant="section">Metadata</Heading>
        <div className="grid grid-cols-3 gap-4 font-mono text-sm">
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Sort Name</span>
            <p className="text-text-primary">{artist.sort_name}</p>
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Collective</span>
            <p className="text-text-primary">{artist.is_collective ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Enriched At</span>
            <p className="text-text-primary">
              {artist.enriched_at
                ? new Date(artist.enriched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function BioCard({
  title,
  content,
  onActivate,
  isActive,
}: {
  title: string
  content: string | null
  onActivate?: () => void
  isActive?: boolean
}) {
  return (
    <div className={`border p-4 space-y-2 ${isActive ? 'border-accent' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-secondary">{title}</span>
        {onActivate && !isActive && (
          <Button variant="secondary" fullWidth={false} className="!text-[10px] !px-2 !py-1" onClick={onActivate}>
            Activate
          </Button>
        )}
      </div>
      {content ? (
        <p className="font-mono text-xs text-text-primary leading-relaxed max-h-40 overflow-y-auto">
          {content}
        </p>
      ) : (
        <p className="font-mono text-xs text-border italic">No content</p>
      )}
    </div>
  )
}
