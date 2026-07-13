import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EnrichmentStatusBadge } from '../../components/admin/EnrichmentStatusBadge'
import { useAdminArtists, useUpdateArtist, useUpdateAndRefetch, useApproveArtists } from '../../hooks/useAdminArtists'
import {
  InlineEdit, InlineLocationEdit,
  scHandle, igHandle, bcHandle,
  scParse, scBuild, igParse, igBuild, bcParse, bcBuild,
  discogsUrl,
} from '../../components/admin/InlineEdit'
import type { Artist, FieldConfidence, ImageCandidate } from '../../types/database'

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'candidates', label: 'Re-review imgs' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

const LEVEL_ORDER = { high: 0, medium: 1, low: 2 } as const
type Level = keyof typeof LEVEL_ORDER

// Queue grouping = aggregated confidence: the weakest identity-critical field
// (SC, image, IG) sets the group; per-field chips carry the detail (ADR 011)
function aggregateLevel(a: Artist): Level | 'unscored' {
  const fc = a.enrichment_confidence
  if (!fc) return 'unscored'
  const levels = ['soundcloud', 'image', 'instagram']
    .map(k => fc[k]?.level)
    .filter((l): l is Level => !!l)
  if (levels.length === 0) return 'unscored'
  return levels.reduce((worst, l) => LEVEL_ORDER[l] > LEVEL_ORDER[worst] ? l : worst)
}

const GROUPS: Array<{ key: Level | 'unscored'; label: string; hint: string }> = [
  { key: 'high', label: 'High confidence', hint: 'spot-check, then batch approve' },
  { key: 'medium', label: 'Medium confidence', hint: 'quick glance per card' },
  { key: 'low', label: 'Low / conflicts', hint: 'needs your judgment' },
  { key: 'unscored', label: 'Unscored', hint: 'enriched before per-field confidence existed' },
]

const CHIP_STYLE: Record<Level, string> = {
  high: 'border border-accent text-accent',
  medium: 'border border-border text-text-secondary',
  low: 'border border-conflict text-conflict',
}

function ConfidenceChip({ fc }: { fc: FieldConfidence | undefined }) {
  if (!fc) return null
  return (
    <span
      className={`inline-flex px-1 text-[10px] font-mono font-bold uppercase leading-tight cursor-help ${CHIP_STYLE[fc.level]}`}
      title={fc.evidence.join('\n')}
    >
      {fc.level === 'high' ? 'H' : fc.level === 'medium' ? 'M' : 'L'}
    </span>
  )
}

// Explicitly touching a field = highest confidence tier with an admin stamp;
// prior machine confidence stays in the evidence trail as provenance (ADR 011)
function confirmField(a: Artist, key: string): Record<string, FieldConfidence> {
  const stamp = `admin-confirmed ${new Date().toISOString().slice(0, 10)}`
  const prior = a.enrichment_confidence?.[key]
  const provenance = prior
    ? (prior.level !== 'high' ? [`was ${prior.level}`, ...prior.evidence] : prior.evidence)
    : []
  return {
    ...(a.enrichment_confidence ?? {}),
    [key]: { level: 'high', evidence: [stamp, ...provenance.filter(e => !e.startsWith('admin-confirmed'))] },
  }
}

function sourceLabel(source: string) {
  if (source.startsWith('soundcloud')) return 'SC'
  if (source.startsWith('discogs')) return 'Discogs'
  if (source.startsWith('festival:')) return source
  return source
}

function Carousel({ artist, onPick }: { artist: Artist; onPick: (url: string) => void }) {
  const candidates = artist.image_candidates ?? []
  const selected = artist.image_url

  return (
    <div className="w-44 shrink-0 space-y-1.5">
      {selected ? (
        <img src={selected} alt="" className="w-44 h-44 object-cover border border-border" />
      ) : (
        <div className="w-44 h-44 bg-surface-raised border border-border flex items-center justify-center font-mono text-xs text-text-secondary">
          No image
        </div>
      )}
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {candidates.map(c => (
            <CandidateThumb key={c.url} candidate={c} selected={c.url === selected} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateThumb({ candidate, selected, onPick }: {
  candidate: ImageCandidate
  selected: boolean
  onPick: (url: string) => void
}) {
  return (
    <button
      onClick={() => !selected && onPick(candidate.url)}
      className={`relative block cursor-pointer ${selected ? 'outline-2 outline-accent' : 'opacity-80 hover:opacity-100'}`}
      title={`${candidate.source}${candidate.confidence ? ` · ${candidate.confidence}` : ''} · score ${Math.round(candidate.score)}`}
    >
      <img src={candidate.url} alt="" className="w-12 h-12 object-cover border border-border" />
      <span className={`absolute bottom-0 inset-x-0 text-[8px] font-mono uppercase leading-tight text-center truncate px-0.5 ${
        candidate.confidence === 'low' ? 'bg-surface/90 text-conflict' : 'bg-surface/90 text-text-secondary'
      }`}>
        {sourceLabel(candidate.source)}
      </span>
    </button>
  )
}

function ReviewCard({ artist, focused, onApprove, onFlag, cardRef }: {
  artist: Artist
  focused: boolean
  onApprove: () => void
  onFlag: () => void
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const updateArtist = useUpdateArtist()
  const updateAndRefetch = useUpdateAndRefetch()
  const fc = artist.enrichment_confidence ?? {}

  function saveField(field: string, confKey: string, value: string | number | null) {
    const updates = { [field]: value, enrichment_confidence: confirmField(artist, confKey) }
    if (field === 'soundcloud_url' && value && value !== artist.soundcloud_url) {
      updateAndRefetch.mutate({ artistId: artist.id, updates: updates as Partial<Artist> })
    } else {
      updateArtist.mutate({ id: artist.id, ...updates } as Partial<Artist> & { id: string })
    }
  }

  function pickImage(url: string) {
    updateArtist.mutate({
      id: artist.id,
      image_url: url,
      enrichment_confidence: confirmField(artist, 'image'),
    } as Partial<Artist> & { id: string })
  }

  const conflicts = Object.entries(fc)
    .filter(([, v]) => v.level === 'low' && v.evidence.some(e => e.includes('DIFFER') || e.includes('conflict')))

  return (
    <div
      ref={cardRef}
      className={`border p-4 flex gap-4 transition-colors ${focused ? 'border-accent bg-surface-raised' : 'border-border'}`}
    >
      <Carousel artist={artist} onPick={pickImage} />

      <div className="flex-1 min-w-0 space-y-2.5 font-mono text-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/admin/artists/${artist.id}`} className="font-bold text-base text-text-primary hover:text-accent transition-colors">
            {artist.name}
          </Link>
          <ConfidenceChip fc={fc.image} />
          <EnrichmentStatusBadge status={artist.enrichment_status} />
          {artist.soundcloud_followers != null && (
            <span className="text-xs text-text-secondary">{artist.soundcloud_followers.toLocaleString()} SC followers</span>
          )}
        </div>

        {conflicts.length > 0 && (
          <div className="space-y-0.5">
            {conflicts.map(([key, v]) => (
              <p key={key} className="text-xs text-conflict">
                {key}: {v.evidence.filter(e => e.includes('DIFFER') || e.includes('conflict')).join(' · ')}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 max-w-2xl">
          <FieldRow label="SoundCloud" chip={fc.soundcloud}>
            <InlineEdit
              value={artist.soundcloud_url ?? ''}
              displayValue={scHandle(artist.soundcloud_url)}
              href={artist.soundcloud_url}
              onSave={v => saveField('soundcloud_url', 'soundcloud', v || null)}
              placeholder="soundcloud.com/..."
              parse={scParse}
              build={scBuild}
            />
          </FieldRow>
          <FieldRow label="Instagram" chip={fc.instagram}>
            <InlineEdit
              value={artist.instagram_url ?? ''}
              displayValue={igHandle(artist.instagram_url)}
              href={artist.instagram_url}
              onSave={v => saveField('instagram_url', 'instagram', v || null)}
              placeholder="instagram.com/..."
              parse={igParse}
              build={igBuild}
            />
          </FieldRow>
          <FieldRow label="Bandcamp" chip={fc.bandcamp}>
            <InlineEdit
              value={artist.bandcamp_url ?? ''}
              displayValue={bcHandle(artist.bandcamp_url)}
              href={artist.bandcamp_url}
              onSave={v => saveField('bandcamp_url', 'bandcamp', v || null)}
              placeholder="x.bandcamp.com"
              parse={bcParse}
              build={bcBuild}
            />
          </FieldRow>
          <FieldRow label="Discogs" chip={fc.discogs}>
            <InlineEdit
              value={artist.discogs_id ? String(artist.discogs_id) : ''}
              displayValue={artist.discogs_id ? String(artist.discogs_id) : null}
              href={artist.discogs_id ? discogsUrl(artist.discogs_id) : null}
              onSave={v => {
                const digits = v.replace(/\D/g, '')
                saveField('discogs_id', 'discogs', digits ? Number(digits) : null)
              }}
              placeholder="id"
            />
          </FieldRow>
          <FieldRow label="Location" chip={fc.location}>
            <InlineLocationEdit
              city={artist.city}
              countryCode={artist.country_code}
              onSave={(city, countryCode) => {
                updateArtist.mutate({
                  id: artist.id,
                  city: city || null,
                  country_code: countryCode || null,
                  enrichment_confidence: confirmField(artist, 'location'),
                } as Partial<Artist> & { id: string })
              }}
            />
          </FieldRow>
        </div>
      </div>

      <div className="shrink-0 flex flex-col gap-1.5 w-24">
        {artist.enrichment_status !== 'reviewed' && (
          <Button variant="secondary" fullWidth={false} className="!text-xs !px-2 !py-1.5" onClick={onApprove}>
            Approve
          </Button>
        )}
        {artist.enrichment_status !== 'flagged' && (
          <Button variant="secondary" fullWidth={false} className="!text-xs !px-2 !py-1.5 !text-conflict" onClick={onFlag}>
            Flag
          </Button>
        )}
      </div>
    </div>
  )
}

function FieldRow({ label, chip, children }: { label: string; chip: FieldConfidence | undefined; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-24 shrink-0 text-xs uppercase tracking-wider text-text-secondary">{label}</span>
      <ConfidenceChip fc={chip} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default function AdminEnrichmentReview() {
  const [filter, setFilter] = useState<FilterKey>('pending')
  const [focusIndex, setFocusIndex] = useState(0)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { data: result, isLoading } = useAdminArtists({
    status: filter === 'candidates' ? undefined : filter,
    hasCandidates: filter === 'candidates' || undefined,
    limit: 200,
  })
  const updateArtist = useUpdateArtist()
  const approveArtists = useApproveArtists()

  const artists = (result?.data ?? []) as Artist[]

  const grouped = useMemo(() => {
    const byGroup = new Map<string, Artist[]>()
    for (const a of artists) {
      const g = aggregateLevel(a)
      byGroup.set(g, [...(byGroup.get(g) ?? []), a])
    }
    // alphabetical within groups — server already orders by sort_name
    return GROUPS.map(g => ({ ...g, artists: byGroup.get(g.key) ?? [] })).filter(g => g.artists.length > 0)
  }, [artists])

  const flatList = useMemo(() => grouped.flatMap(g => g.artists), [grouped])

  const approve = useCallback((artist: Artist) => {
    approveArtists.mutate({ artistIds: [artist.id] })
  }, [approveArtists])

  const flag = useCallback((artist: Artist) => {
    updateArtist.mutate({ id: artist.id, enrichment_status: 'flagged' } as Partial<Artist> & { id: string })
  }, [updateArtist])

  // Keyboard: J/K navigate, A approve + advance, X flag + advance
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (flatList.length === 0) return
      const key = e.key.toLowerCase()
      if (key === 'j') {
        e.preventDefault()
        setFocusIndex(i => Math.min(i + 1, flatList.length - 1))
      } else if (key === 'k') {
        e.preventDefault()
        setFocusIndex(i => Math.max(i - 1, 0))
      } else if (key === 'a') {
        e.preventDefault()
        const artist = flatList[focusIndex]
        if (artist) {
          approve(artist)
          setFocusIndex(i => Math.min(i + 1, flatList.length - 1))
        }
      } else if (key === 'x') {
        e.preventDefault()
        const artist = flatList[focusIndex]
        if (artist) {
          flag(artist)
          setFocusIndex(i => Math.min(i + 1, flatList.length - 1))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flatList, focusIndex, approve, flag])

  useEffect(() => {
    const artist = flatList[focusIndex]
    if (artist) {
      cardRefs.current.get(artist.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusIndex, flatList])

  useEffect(() => { setFocusIndex(0) }, [filter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Heading variant="page">Enrichment Review</Heading>
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">
          J/K navigate · A approve · X flag
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-0.5">
          {FILTERS.map(f => (
            <Button
              key={f.key}
              variant="segment"
              active={filter === f.key}
              fullWidth={false}
              className="px-3 py-1.5"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <span className="font-mono text-sm text-text-secondary">{result?.count ?? 0} artists</span>
      </div>

      {isLoading ? (
        <p className="font-mono text-sm text-text-secondary py-8 text-center">Loading...</p>
      ) : flatList.length === 0 ? (
        <p className="font-mono text-sm text-text-secondary py-8 text-center">Queue is empty.</p>
      ) : (
        grouped.map(group => (
          <section key={group.key} className="space-y-2">
            <div className="flex items-center gap-3 pt-2">
              <Badge variant={group.key === 'high' ? 'accent' : group.key === 'low' ? 'conflict' : 'outline'}>
                {group.label}
              </Badge>
              <span className="font-mono text-xs text-text-secondary">
                {group.artists.length} · {group.hint}
              </span>
              {filter !== 'reviewed' && group.artists.length > 1 && (
                <Button
                  variant="secondary"
                  fullWidth={false}
                  className="!text-xs !px-2 !py-1 ml-auto"
                  disabled={approveArtists.isPending}
                  onClick={() => approveArtists.mutate({ artistIds: group.artists.map(a => a.id) })}
                >
                  Approve all {group.artists.length}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {group.artists.map(a => (
                <ReviewCard
                  key={a.id}
                  artist={a}
                  focused={flatList[focusIndex]?.id === a.id}
                  onApprove={() => approve(a)}
                  onFlag={() => flag(a)}
                  cardRef={el => {
                    if (el) cardRefs.current.set(a.id, el)
                    else cardRefs.current.delete(a.id)
                  }}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
