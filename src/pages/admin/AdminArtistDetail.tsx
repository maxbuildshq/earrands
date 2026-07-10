import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { EnrichmentStatusBadge } from '../../components/admin/EnrichmentStatusBadge'
import { SourceLabel } from '../../components/admin/SourceLabel'
import {
  InlineEdit, InlineLocationEdit,
  scHandle, igHandle, bcHandle,
  scParse, scBuild, igParse, igBuild, bcParse, bcBuild,
  discogsUrl,
} from '../../components/admin/InlineEdit'
import { useAdminArtist, useUpdateArtist, useUpdateAndRefetch, useActivateBio } from '../../hooks/useAdminArtists'
import { useCreateJob, useAdminJobs } from '../../hooks/useAdminJobs'

export default function AdminArtistDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: artist, isLoading } = useAdminArtist(id)

  const [searchKeywords, setSearchKeywords] = useState('')

  const update = useUpdateArtist()
  const updateAndRefetch = useUpdateAndRefetch()
  const activateBio = useActivateBio()
  const createJob = useCreateJob()
  useAdminJobs()

  if (isLoading || !artist) {
    return (
      <div className="space-y-8">
        <Heading variant="page">Loading...</Heading>
      </div>
    )
  }

  function handleInlineSave(field: string, value: string, oldUrl: string | null) {
    if (field === 'soundcloud_url' && value !== (oldUrl ?? '')) {
      updateAndRefetch.mutate({ artistId: artist!.id, updates: { [field]: value || null } })
    } else {
      update.mutate({ id: artist!.id, [field]: value || null } as any)
    }
  }

  function handleLocationSave(city: string, countryCode: string) {
    update.mutate({ id: artist!.id, city: city || null, country_code: countryCode || null } as any)
  }

  function handleDiscogsSave(value: string) {
    const digits = value.replace(/\D/g, '')
    update.mutate({ id: artist!.id, discogs_id: digits ? Number(digits) : null } as any)
  }

  function handleStatusChange(newStatus: string) {
    update.mutate({
      id: artist!.id,
      enrichment_status: newStatus,
      ...(newStatus === 'reviewed' ? { enriched_at: new Date().toISOString() } : {}),
    } as any)
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
            onClick={() => createJob.mutate({ type: 'enrich', artist_sort_names: [artist.sort_name], ...(searchKeywords && { search_keywords: searchKeywords }) })}
            disabled={createJob.isPending}
          >
            Enrich
          </Button>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => createJob.mutate({ type: 'enrich', artist_sort_names: [artist.sort_name], fields: ['bio'], ...(searchKeywords && { search_keywords: searchKeywords }) })}
            disabled={createJob.isPending}
          >
            Bio + AI
          </Button>
          <input
            className="bg-transparent border-b border-border text-text-primary font-mono text-xs w-40 outline-none placeholder:text-border focus:border-accent py-1"
            value={searchKeywords}
            onChange={e => setSearchKeywords(e.target.value)}
            placeholder="Search keywords..."
            title="Optional keywords appended to Brave search queries (e.g. &quot;drum &amp; bass&quot;)"
          />
        </div>
      </div>

      {/* Links & Fields */}
      <section className="border border-border p-6 space-y-4">
        <Heading variant="section">Profile & Links</Heading>

        <div className="grid grid-cols-2 gap-4 font-mono text-sm">
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Name</span>
            <InlineEdit
              value={artist.name}
              displayValue={artist.name}
              href={null}
              onSave={val => handleInlineSave('name', val, null)}
              placeholder="Name"
            />
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">SoundCloud</span>
            <InlineEdit
              value={artist.soundcloud_url ?? ''}
              displayValue={scHandle(artist.soundcloud_url)}
              href={artist.soundcloud_url}
              onSave={val => handleInlineSave('soundcloud_url', val, artist.soundcloud_url)}
              placeholder="soundcloud.com/..."
              parse={scParse}
              build={scBuild}
            />
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Instagram</span>
            <InlineEdit
              value={artist.instagram_url ?? ''}
              displayValue={igHandle(artist.instagram_url)}
              href={artist.instagram_url}
              onSave={val => handleInlineSave('instagram_url', val, null)}
              placeholder="instagram.com/..."
              parse={igParse}
              build={igBuild}
            />
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Bandcamp</span>
            <InlineEdit
              value={artist.bandcamp_url ?? ''}
              displayValue={bcHandle(artist.bandcamp_url)}
              href={artist.bandcamp_url}
              onSave={val => handleInlineSave('bandcamp_url', val, null)}
              placeholder="x.bandcamp.com"
              parse={bcParse}
              build={bcBuild}
            />
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Image</span>
            <InlineEdit
              value={artist.image_url ?? ''}
              displayValue={artist.image_url ? 'View' : null}
              href={artist.image_url}
              onSave={val => handleInlineSave('image_url', val, null)}
              placeholder="https://..."
            />
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Location</span>
            <div>
              <InlineLocationEdit
                city={artist.city}
                countryCode={artist.country_code}
                onSave={handleLocationSave}
              />
            </div>
          </div>
          <div>
            <span className="text-text-secondary text-xs uppercase tracking-wider">Discogs ID</span>
            <InlineEdit
              value={artist.discogs_id ? String(artist.discogs_id) : ''}
              displayValue={artist.discogs_id ? String(artist.discogs_id) : null}
              href={artist.discogs_id ? discogsUrl(artist.discogs_id) : null}
              onSave={val => handleDiscogsSave(val)}
              placeholder="id"
            />
          </div>
        </div>
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
            warning={artist.bio_research?.festival_bio_flagged ? 'Contains festival name — may not be suitable for cross-festival use' : undefined}
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
  warning,
}: {
  title: string
  content: string | null
  onActivate?: () => void
  isActive?: boolean
  warning?: string
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
      {warning && (
        <p className="font-mono text-xs text-negative">{warning}</p>
      )}
      {content ? (
        <p className="font-mono text-xs text-text-primary leading-relaxed max-h-40 overflow-y-auto whitespace-pre-line">
          {content}
        </p>
      ) : (
        <p className="font-mono text-xs text-border italic">No content</p>
      )}
    </div>
  )
}
