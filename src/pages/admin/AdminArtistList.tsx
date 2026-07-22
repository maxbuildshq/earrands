import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { EnrichmentStatusBadge } from '../../components/admin/EnrichmentStatusBadge'
import { SourceLabel } from '../../components/admin/SourceLabel'
import { useAdminArtists, useBulkUpdateArtists, useUpdateArtist, useUpdateAndRefetch, useActivateBio } from '../../hooks/useAdminArtists'
import { useAdminFestivals } from '../../hooks/useAdminFestivals'
import { useCreateJob, useAdminJobs } from '../../hooks/useAdminJobs'
import {
  InlineEdit, InlineLocationEdit, InlineTextEdit,
  scHandle, igHandle, bcHandle,
  scParse, scBuild, igParse, igBuild, bcParse, bcBuild,
  discogsUrl,
} from '../../components/admin/InlineEdit'

import type { Artist, FieldConfidence } from '../../types/database'
import {
  aggregateLevel, CONFIDENCE_FILTERS, ENRICH_FIELDS, PAGE_SIZES,
  rememberedFestival, rememberFestival, KEYWORDS_INPUT_CLASS,
} from '../../lib/adminFilters'

const STATUS_OPTIONS = ['all', 'pending', 'enriched', 'reviewed', 'flagged'] as const

// Which DB column backs each bio version (inline edits write to it)
const BIO_COLUMN: Record<string, 'bio' | 'bio_festival' | 'bio_generated'> = {
  Active: 'bio', Festival: 'bio_festival', Generated: 'bio_generated',
}

function ImageHover({ src }: { src: string | null }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const imgRef = useRef<HTMLImageElement>(null)

  function handleEnter() {
    timerRef.current = setTimeout(() => {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect()
        setPos({ top: Math.max(8, rect.top - 224 + 32), left: rect.right + 8 })
      }
    }, 200)
  }
  function handleLeave() {
    clearTimeout(timerRef.current)
    setPos(null)
  }

  if (!src) return <div className="w-10 h-10 bg-surface-raised border border-border" />
  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <img ref={imgRef} src={src} alt="" className="w-10 h-10 object-cover cursor-pointer" />
      {pos && (
        <div className="fixed z-[100] pointer-events-none" style={{ top: pos.top, left: pos.left }}>
          <img src={src} alt="" className="w-56 h-56 object-cover border border-border shadow-lg" />
        </div>
      )}
    </div>
  )
}

type ArtistRow = {
  id: string
  name: string
  sort_name: string
  image_url: string | null
  soundcloud_url: string | null
  instagram_url: string | null
  bandcamp_url: string | null
  discogs_id: number | null
  bio: string | null
  bio_festival: string | null
  bio_generated: string | null
  bio_source: string | null
  bio_research: { festival_bio_flagged?: boolean } | null
  city: string | null
  country_code: string | null
  enrichment_status: string
  enriched_at: string | null
  enrichment_confidence: Record<string, FieldConfidence> | null
}

function BioPopover({ artist }: { artist: ArtistRow }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activateBio = useActivateBio()
  const updateArtist = useUpdateArtist()

  useEffect(() => {
    if (!show) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [show])

  if (!artist.bio && !artist.bio_festival && !artist.bio_generated) {
    return <span className="text-border">—</span>
  }

  const festivalFlagged = !!artist.bio_research?.festival_bio_flagged
  const sources: { label: string; content: string | null; sourceKey: string; warning?: string }[] = [
    { label: 'Active', content: artist.bio, sourceKey: artist.bio_source ?? '' },
    { label: 'Festival', content: artist.bio_festival, sourceKey: 'festival', warning: festivalFlagged ? 'Contains festival name' : undefined },
    { label: 'Generated', content: artist.bio_generated, sourceKey: 'generated' },
  ].filter(s => s.content)

  return (
    <div className="relative" ref={ref}>
      <button className="text-accent cursor-pointer text-left" onClick={() => setShow(!show)}>
        Yes
        {artist.bio_source && <SourceLabel source={artist.bio_source} />}
      </button>
      {show && sources.length > 0 && (
        <div className="absolute z-50 right-0 top-6 w-[480px] border border-border bg-surface shadow-lg p-3 space-y-3">
          {sources.map(s => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-secondary">
                  {s.label}
                  {s.sourceKey === artist.bio_source && s.label !== 'Active' && (
                    <span className="text-accent ml-1">●</span>
                  )}
                </span>
                {s.label !== 'Active' && s.content && s.content !== artist.bio && (
                  <button
                    className="font-mono text-xs text-accent hover:underline uppercase tracking-wider"
                    onClick={(e) => {
                      e.stopPropagation()
                      activateBio.mutate({ artistId: artist.id, source: s.sourceKey })
                    }}
                  >
                    Activate
                  </button>
                )}
              </div>
              {s.warning && (
                <p className="font-mono text-xs text-negative">{s.warning}</p>
              )}
              <InlineTextEdit
                value={s.content}
                className="max-h-48 overflow-y-auto"
                onSave={v => updateArtist.mutate({
                  id: artist.id,
                  [BIO_COLUMN[s.label]]: v || null,
                } as Partial<Artist> & { id: string })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminArtistList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const confidence = searchParams.get('confidence') ?? 'all'
  // URL param wins; otherwise fall back to the session-remembered festival
  const festivalId = searchParams.get('festival') ?? rememberedFestival()
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const pageSize = parseInt(searchParams.get('size') ?? '50', 10)

  const setFilter = useCallback((key: string, value: string, resetPage = true) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value && value !== 'all' && value !== '0' && value !== '50') {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      if (resetPage && key !== 'page') next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setSearch = (v: string) => setFilter('q', v)
  const setStatus = (v: string) => setFilter('status', v)
  const setConfidence = (v: string) => setFilter('confidence', v)
  const setFestivalId = (v: string) => {
    rememberFestival(v)
    setFilter('festival', v)
  }
  const setPage = (v: number) => setFilter('page', String(v), false)
  const setPageSize = (v: number) => setFilter('size', String(v))

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkFields, setBulkFields] = useState<Set<string>>(new Set())
  const [searchKeywords, setSearchKeywords] = useState('')

  function toggleBulkField(field: string, v: boolean) {
    setBulkFields(prev => {
      const next = new Set(prev)
      if (v) next.add(field)
      else next.delete(field)
      return next
    })
  }

  const { data: festivals = [] } = useAdminFestivals()
  useAdminJobs() // polls jobs — auto-refreshes artist data when jobs complete
  const { data: result, isLoading } = useAdminArtists({
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
    festivalId: festivalId || undefined,
    limit: pageSize,
    offset: page * pageSize,
  })
  const bulkUpdate = useBulkUpdateArtists()
  const updateArtist = useUpdateArtist()
  const updateAndRefetch = useUpdateAndRefetch()
  const createJob = useCreateJob()

  const allRows = (result?.data ?? []) as ArtistRow[]
  // Confidence filter is client-side within the page, mirroring Enrichment Review
  const artists = useMemo(
    () => confidence === 'all' ? allRows : allRows.filter(a => aggregateLevel(a) === confidence),
    [allRows, confidence],
  )
  const totalCount = result?.count ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const allSelected = useMemo(
    () => artists.length > 0 && artists.every(a => selected.has(a.id)),
    [artists, selected],
  )

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(artists.map(a => a.id)))
  }

  const lastChecked = useRef<number | null>(null)

  function toggleOne(id: string, index: number, shiftKey: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (shiftKey && lastChecked.current !== null && lastChecked.current !== index) {
        const from = Math.min(lastChecked.current, index)
        const to = Math.max(lastChecked.current, index)
        for (let i = from; i <= to; i++) {
          next.add(artists[i].id)
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      lastChecked.current = index
      return next
    })
  }

  function handleBulkApprove() {
    bulkUpdate.mutate(
      { artistIds: [...selected], updates: { enrichment_status: 'reviewed' } as Record<string, unknown> },
      { onSuccess: () => setSelected(new Set()) },
    )
  }

  function handleBulkEnrich() {
    const names = artists.filter(a => selected.has(a.id)).map(a => a.sort_name)
    createJob.mutate({
      type: 'enrich',
      artist_sort_names: names,
      ...(bulkFields.size > 0 && { fields: [...bulkFields] }),
      ...(searchKeywords && { search_keywords: searchKeywords }),
    })
    setSelected(new Set())
  }

  function handleBulkBioResearch() {
    const names = artists.filter(a => selected.has(a.id)).map(a => a.sort_name)
    createJob.mutate({ type: 'enrich', artist_sort_names: names, fields: ['bio'], ...(searchKeywords && { search_keywords: searchKeywords }) })
    setSelected(new Set())
  }

  function handleApproveOne(id: string) {
    updateArtist.mutate({ id, enrichment_status: 'reviewed', enriched_at: new Date().toISOString() } as any)
  }

  function handleEnrichOne(sortName: string) {
    createJob.mutate({ type: 'enrich', artist_sort_names: [sortName], ...(searchKeywords && { search_keywords: searchKeywords }) })
  }

  function handleBioResearchOne(sortName: string) {
    createJob.mutate({ type: 'enrich', artist_sort_names: [sortName], fields: ['bio'], ...(searchKeywords && { search_keywords: searchKeywords }) })
  }

  function handleInlineSave(artistId: string, field: string, value: string, oldUrl: string | null) {
    if (field === 'soundcloud_url' && value !== (oldUrl ?? '')) {
      updateAndRefetch.mutate({ artistId, updates: { [field]: value || null } })
    } else {
      updateArtist.mutate({ id: artistId, [field]: value || null } as any)
    }
  }

  function handleLocationSave(artistId: string, city: string, countryCode: string) {
    updateArtist.mutate({ id: artistId, city: city || null, country_code: countryCode || null } as any)
  }

  function handleDiscogsSave(artistId: string, value: string) {
    const digits = value.replace(/\D/g, '')
    updateArtist.mutate({ id: artistId, discogs_id: digits ? Number(digits) : null } as any)
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize)
  }

  return (
    <div className="space-y-4">
      <Heading variant="page">Artists</Heading>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 max-w-xs">
          <Input placeholder="Search artists..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-0.5">
          {STATUS_OPTIONS.map(s => (
            <Button
              key={s}
              variant="segment"
              active={status === s}
              fullWidth={false}
              className="px-3 py-1.5"
              onClick={() => setStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="flex gap-0.5">
          {CONFIDENCE_FILTERS.map(c => (
            <Button
              key={c}
              variant="segment"
              active={confidence === c}
              fullWidth={false}
              className="px-3 py-1.5"
              onClick={() => setConfidence(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <select
          value={festivalId}
          onChange={e => setFestivalId(e.target.value)}
          className="bg-surface border border-border text-text-primary font-mono text-sm px-3 py-2 uppercase tracking-wider"
        >
          <option value="">All festivals</option>
          {festivals.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <span className="font-mono text-sm text-text-secondary">{totalCount} results</span>
      </div>

      {/* Bulk actions bar */}
      <div className="flex items-center gap-2 flex-wrap font-mono text-sm border border-border px-3 py-2.5">
        <span className="text-text-secondary">{selected.size} selected</span>
        <Button variant="secondary" fullWidth={false} className="!text-xs !px-3 !py-1" onClick={handleBulkApprove} disabled={selected.size === 0 || bulkUpdate.isPending}>
          Approve
        </Button>
        <Button
          variant="secondary"
          fullWidth={false}
          className="!text-xs !px-3 !py-1"
          onClick={handleBulkEnrich}
          disabled={selected.size === 0 || createJob.isPending}
          title={bulkFields.size > 0 ? `Fields: ${[...bulkFields].join(', ')}` : 'Full enrichment (no fields selected)'}
        >
          Enrich{bulkFields.size > 0 ? ` (${bulkFields.size} fields)` : ''}
        </Button>
        <Button variant="secondary" fullWidth={false} className="!text-xs !px-3 !py-1" onClick={handleBulkBioResearch} disabled={selected.size === 0 || createJob.isPending}>
          Bio + AI
        </Button>
        {selected.size > 0 && (
          <button className="text-text-secondary hover:text-accent text-xs uppercase tracking-wider" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        )}
        <span className="text-border">|</span>
        {ENRICH_FIELDS.map(f => (
          <label key={f} className="flex items-center gap-1 text-xs uppercase tracking-wider text-text-secondary cursor-pointer">
            <input type="checkbox" checked={bulkFields.has(f)} onChange={e => toggleBulkField(f, e.target.checked)} className="accent-accent" />
            {f}
          </label>
        ))}
        <input
          className={KEYWORDS_INPUT_CLASS}
          value={searchKeywords}
          onChange={e => setSearchKeywords(e.target.value)}
          placeholder="Search keywords..."
          title="Optional keywords appended to Brave search queries (e.g. &quot;drum &amp; bass&quot;)"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-text-secondary text-xs uppercase tracking-wider">Per page:</span>
          {PAGE_SIZES.map(s => (
            <button
              key={s}
              className={`text-xs px-1 ${pageSize === s ? 'text-accent font-bold' : 'text-text-secondary hover:text-accent'}`}
              onClick={() => handlePageSizeChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border overflow-x-auto">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-widest text-text-secondary">
              <th className="px-3 py-2.5 text-left w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-accent" />
              </th>
              <th className="px-2 py-2.5 text-left w-12">Image</th>
              <th className="px-3 py-2.5 text-left">Name</th>
              <th className="px-3 py-2.5 text-left">Location</th>
              <th className="px-3 py-2.5 text-left">SoundCloud</th>
              <th className="px-3 py-2.5 text-left">Instagram</th>
              <th className="px-3 py-2.5 text-left">Bandcamp</th>
              <th className="px-3 py-2.5 text-left">Discogs</th>
              <th className="px-3 py-2.5 text-left w-16">Bio</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-text-secondary">Loading...</td></tr>
            ) : artists.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-text-secondary">No artists found.</td></tr>
            ) : (
              artists.map((a, i) => (
                <tr key={a.id} className="border-b border-border last:border-b-0 hover:bg-surface-raised transition-colors">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(a.id)} onClick={e => toggleOne(a.id, i, e.shiftKey)} onChange={() => {}} className="accent-accent" />
                  </td>
                  <td className="px-2 py-3">
                    <InlineEdit
                      value={a.image_url ?? ''}
                      displayValue={a.image_url}
                      href={null}
                      onSave={val => handleInlineSave(a.id, 'image_url', val, null)}
                      placeholder="https://..."
                      renderDisplay={<ImageHover src={a.image_url} />}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/admin/artists/${a.id}`} className="font-bold text-text-primary hover:text-accent transition-colors">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 max-w-[120px]">
                    <InlineLocationEdit
                      city={a.city}
                      countryCode={a.country_code}
                      onSave={(city, countryCode) => handleLocationSave(a.id, city, countryCode)}
                    />
                  </td>
                  <td className="px-3 py-3 max-w-[160px]">
                    <InlineEdit
                      value={a.soundcloud_url ?? ''}
                      displayValue={scHandle(a.soundcloud_url)}
                      href={a.soundcloud_url}
                      onSave={val => handleInlineSave(a.id, 'soundcloud_url', val, a.soundcloud_url)}
                      placeholder="soundcloud.com/..."
                      parse={scParse}
                      build={scBuild}
                    />
                  </td>
                  <td className="px-3 py-3 max-w-[140px]">
                    <InlineEdit
                      value={a.instagram_url ?? ''}
                      displayValue={igHandle(a.instagram_url)}
                      href={a.instagram_url}
                      onSave={val => handleInlineSave(a.id, 'instagram_url', val, null)}
                      placeholder="instagram.com/..."
                      parse={igParse}
                      build={igBuild}
                    />
                  </td>
                  <td className="px-3 py-3 max-w-[140px]">
                    <InlineEdit
                      value={a.bandcamp_url ?? ''}
                      displayValue={bcHandle(a.bandcamp_url)}
                      href={a.bandcamp_url}
                      onSave={val => handleInlineSave(a.id, 'bandcamp_url', val, null)}
                      placeholder="x.bandcamp.com"
                      parse={bcParse}
                      build={bcBuild}
                    />
                  </td>
                  <td className="px-3 py-3 max-w-[100px]">
                    <InlineEdit
                      value={a.discogs_id ? String(a.discogs_id) : ''}
                      displayValue={a.discogs_id ? String(a.discogs_id) : null}
                      href={a.discogs_id ? discogsUrl(a.discogs_id) : null}
                      onSave={val => handleDiscogsSave(a.id, val)}
                      placeholder="id"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <BioPopover artist={a} />
                  </td>
                  <td className="px-3 py-3">
                    <EnrichmentStatusBadge status={a.enrichment_status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      {a.enrichment_status !== 'reviewed' && (
                        <Button variant="secondary" fullWidth={false} className="!text-xs !px-2 !py-1" onClick={() => handleApproveOne(a.id)} disabled={updateArtist.isPending}>
                          OK
                        </Button>
                      )}
                      <Button variant="secondary" fullWidth={false} className="!text-xs !px-2 !py-1" onClick={() => handleEnrichOne(a.sort_name)} disabled={createJob.isPending}>
                        {a.enrichment_status === 'enriched' || a.enrichment_status === 'reviewed' ? 'Re' : 'Enr'}
                      </Button>
                      <Button variant="secondary" fullWidth={false} className="!text-xs !px-2 !py-1" onClick={() => handleBioResearchOne(a.sort_name)} disabled={createJob.isPending} title="Bio research + generation">
                        Bio
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between font-mono text-sm">
          <span className="text-text-secondary">
            Page {page + 1} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex gap-1">
            <Button variant="secondary" fullWidth={false} className="!text-xs !px-3 !py-1" onClick={() => setPage(0)} disabled={page === 0}>
              ««
            </Button>
            <Button variant="secondary" fullWidth={false} className="!text-xs !px-3 !py-1" onClick={() => setPage(page - 1)} disabled={page === 0}>
              «
            </Button>
            <Button variant="secondary" fullWidth={false} className="!text-xs !px-3 !py-1" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
              »
            </Button>
            <Button variant="secondary" fullWidth={false} className="!text-xs !px-3 !py-1" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
              »»
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
