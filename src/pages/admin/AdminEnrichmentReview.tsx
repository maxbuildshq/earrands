import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EnrichmentStatusBadge } from '../../components/admin/EnrichmentStatusBadge'
import { useAdminArtists, useUpdateArtist, useUpdateAndRefetch, useApproveArtists, useActivateBio } from '../../hooks/useAdminArtists'
import { useAdminFestivals } from '../../hooks/useAdminFestivals'
import { useCreateJob } from '../../hooks/useAdminJobs'
import {
  InlineEdit, InlineLocationEdit, InlineTextEdit,
  scHandle, igHandle, bcHandle,
  scParse, scBuild, igParse, igBuild, bcParse, bcBuild,
  discogsUrl,
} from '../../components/admin/InlineEdit'
import type { Artist, CrossLink, FieldConfidence, ImageCandidate } from '../../types/database'
import {
  aggregateLevel, CONFIDENCE_FILTERS, ENRICH_FIELDS, PAGE_SIZES,
  rememberedFestival, rememberFestival, KEYWORDS_INPUT_CLASS,
  type Level, type ConfidenceFilter,
} from '../../lib/adminFilters'
import { Input } from '../../components/ui/Input'

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'candidates', label: 'Re-review imgs' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

const GROUPS: Array<{ key: Level | 'unscored'; label: string; hint: string }> = [
  { key: 'high', label: 'High confidence', hint: 'spot-check, then batch approve' },
  { key: 'medium', label: 'Medium confidence', hint: 'quick glance per card' },
  { key: 'low', label: 'Low / conflicts', hint: 'needs your judgment' },
  { key: 'unscored', label: 'Unscored', hint: 'enriched before per-field confidence existed' },
]

// Same ordering the pipeline uses to pre-select the winner: confidence tier →
// SC avatar within tier → DETR score (rankImageCandidate in scripts/lib)
function candidateRank(c: ImageCandidate): number {
  const tier = c.confidence ? { high: 2, medium: 1, low: 0 }[c.confidence] : 0
  return tier * 1000 + (c.source.startsWith('soundcloud') ? 500 : 0) + Math.min(c.score, 499)
}

// Semantic color-coding: hi = accent (solid, trusted), med = accent outline
// (plausible, unconfirmed), lo = white on negative (needs attention)
const CHIP_STYLE: Record<Level, string> = {
  high: 'bg-accent text-surface',
  medium: 'border border-accent-dim text-accent-dim',
  low: 'bg-negative text-white',
}

const CHIP_LABEL: Record<Level, string> = { high: 'hi', medium: 'med', low: 'lo' }

const SOURCE_ABBR: Record<string, string> = {
  discogs: 'DC', musicbrainz: 'MB', soundcloud: 'SC', instagram: 'IG', bandcamp: 'BC', brave: 'BRV',
}

// One structured cross-link as a compact row: <SRC id-link> → <DST handle-link>.
// Red when the source points at a different profile than ours (conflict).
function CrossLinkRow({ cl }: { cl: CrossLink }) {
  const linkCls = 'underline hover:text-accent break-all'
  return (
    <span className={`flex items-center gap-1 font-mono text-[11px] normal-case font-normal leading-snug ${cl.agrees ? 'text-white' : 'bg-negative text-white px-1'}`}>
      <span className="uppercase text-text-secondary">{SOURCE_ABBR[cl.from] ?? cl.from}</span>
      <a href={cl.from_url} target="_blank" rel="noreferrer" className={linkCls}>{cl.from_id}</a>
      <span>→</span>
      {cl.to && <span className="uppercase text-text-secondary">{SOURCE_ABBR[cl.to] ?? cl.to}</span>}
      {cl.to_handle && (cl.to_url
        ? <a href={cl.to_url} target="_blank" rel="noreferrer" className={linkCls}>{cl.to_handle}</a>
        : <span>{cl.to_handle}</span>)}
    </span>
  )
}

// Instant tooltip with the full evidence trail — why we believe this field,
// what corroborates it — for every level, not just conflicts. Clicking the chip
// opens a picker to set the level directly (admin override, no value edit needed).
function ConfidenceChip({ fc, onSet }: { fc: FieldConfidence | undefined; onSet?: (level: Level) => void }) {
  const [open, setOpen] = useState(false)
  const [picker, setPicker] = useState(false)
  const crosslinks = fc?.crosslinks ?? []
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { setOpen(false); setPicker(false) }}>
      <button
        type="button"
        onClick={() => onSet && setPicker(p => !p)}
        className={`inline-flex px-1 text-[10px] font-mono uppercase leading-tight ${onSet ? 'cursor-pointer' : 'cursor-help'} ${
          fc ? `font-bold ${CHIP_STYLE[fc.level]}` : 'border border-border text-text-secondary'
        }`}
      >
        {fc ? CHIP_LABEL[fc.level] : '—'}
      </button>
      {(open || picker) && (
        // pt-1 wrapper instead of mt-1: the gap between chip and panel stays
        // hoverable, so moving the cursor into the tooltip doesn't dismiss it
        <span className="absolute z-[110] left-0 top-full w-max pt-1">
        <span className="block max-w-80 bg-surface border border-border shadow-lg px-2 py-1.5 space-y-1">
          {picker && onSet && (
            <span className="flex gap-1 pb-1 border-b border-border">
              {(['high', 'medium', 'low'] as Level[]).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => { onSet(l); setPicker(false) }}
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase cursor-pointer ${CHIP_STYLE[l]} ${fc?.level === l ? 'outline-2 outline-white' : 'opacity-80 hover:opacity-100'}`}
                >
                  {CHIP_LABEL[l]}
                </button>
              ))}
            </span>
          )}
          {fc ? (
            <>
              <ul className="space-y-0.5 list-disc pl-3.5">
                {fc.evidence.map((e, i) => (
                  <li key={i} className="font-mono text-[11px] normal-case font-normal leading-snug text-white">
                    <Linkified text={e} />
                  </li>
                ))}
              </ul>
              {crosslinks.length > 0 && (
                <span className="block pt-1 border-t border-border space-y-0.5">
                  {crosslinks.map((cl, i) => <CrossLinkRow key={i} cl={cl} />)}
                </span>
              )}
            </>
          ) : (
            <span className="block font-mono text-[11px] normal-case font-normal leading-snug text-text-secondary max-w-56">
              No confidence data — enriched before per-field confidence existed
            </span>
          )}
        </span>
        </span>
      )}
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

// Direct confidence override from the chip picker — no value round-trip needed.
// Prior level + machine evidence stay in the trail as provenance (ADR 011).
function adminSetLevel(a: Artist, key: string, level: Level): Record<string, FieldConfidence> {
  const stamp = `admin-set ${level} ${new Date().toISOString().slice(0, 10)}`
  const prior = a.enrichment_confidence?.[key]
  const provenance = prior
    ? [
        ...(prior.level !== level ? [`was ${prior.level}`] : []),
        ...prior.evidence.filter(e => !e.startsWith('admin-set') && !e.startsWith('admin-confirmed') && !e.startsWith('was ')),
      ]
    : []
  return {
    ...(a.enrichment_confidence ?? {}),
    [key]: { level, evidence: [stamp, ...provenance], ...(prior?.crosslinks ? { crosslinks: prior.crosslinks } : {}) },
  }
}

function sourceLabel(source: string) {
  if (source.startsWith('soundcloud')) return 'SC'
  if (source.startsWith('discogs')) return 'Discogs'
  return source
}

// Render evidence text with URLs as short clickable handles — the conflicting
// profile is previewable and openable without leaving the card
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/)
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="underline text-white hover:text-accent break-all">
            {p.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-5 px-1 py-0.5 font-mono text-[11px] font-bold text-text-primary bg-surface-raised border border-border rounded shadow-[0_1px_0_var(--color-border)]">
      {children}
    </kbd>
  )
}

// Full-size preview on hover, no delay — every second matters in review
function HoverPreview({ src, label, children }: { src: string; label?: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  function handleEnter() {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) {
      const top = Math.min(Math.max(8, rect.top - 160), window.innerHeight - 328)
      setPos({ top, left: Math.min(rect.right + 8, window.innerWidth - 328) })
    }
  }

  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setPos(null)}>
      {children}
      {pos && (
        <div className="fixed z-[100] pointer-events-none" style={{ top: pos.top, left: pos.left }}>
          {label && (
            <div className="bg-surface/95 border border-border border-b-0 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-text-primary">
              {label}
            </div>
          )}
          <img src={src} alt="" className="w-80 h-80 object-cover border border-border shadow-lg" />
        </div>
      )}
    </div>
  )
}

function Carousel({ artist, onPick }: { artist: Artist; onPick: (url: string) => void }) {
  const candidates = useMemo(
    () => [...(artist.image_candidates ?? [])].sort((a, b) => candidateRank(b) - candidateRank(a)),
    [artist.image_candidates],
  )
  const selected = artist.image_url
  const winnerSource = candidates.find(c => c.url === selected)?.source

  return (
    <div className="w-44 shrink-0 space-y-1.5">
      {selected ? (
        <HoverPreview src={selected} label={winnerSource ? sourceLabel(winnerSource) : 'current'}>
          <div className="relative">
            <img src={selected} alt="" className="w-44 h-44 object-cover border border-border" />
            {winnerSource && (
              <span className="absolute bottom-0 inset-x-0 bg-surface/90 text-text-secondary text-[10px] font-mono uppercase leading-tight text-center px-0.5">
                {sourceLabel(winnerSource)}
              </span>
            )}
          </div>
        </HoverPreview>
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
    <HoverPreview src={candidate.url} label={`${sourceLabel(candidate.source)}${candidate.confidence ? ` · ${candidate.confidence}` : ''}`}>
      <button
        onClick={() => !selected && onPick(candidate.url)}
        className={`relative block cursor-pointer ${selected ? 'outline-2 outline-accent' : 'opacity-80 hover:opacity-100'}`}
        title={`${candidate.source}${candidate.confidence ? ` · ${candidate.confidence}` : ''} · score ${Math.round(candidate.score)}`}
      >
        <img src={candidate.url} alt="" className="w-12 h-12 object-cover border border-border" />
        <span className={`absolute bottom-0 inset-x-0 text-[8px] font-mono uppercase leading-tight text-center truncate px-0.5 ${
          candidate.confidence === 'low' ? 'bg-negative text-white' : 'bg-surface/90 text-text-secondary'
        }`}>
          {sourceLabel(candidate.source)}
        </span>
      </button>
    </HoverPreview>
  )
}

function FieldRow({ label, chip, checked, onCheck, onSetChip, conflictLines, children }: {
  label: string
  chip: FieldConfidence | undefined | null
  checked?: boolean
  onCheck?: (v: boolean) => void
  onSetChip?: (level: Level) => void
  conflictLines?: string[]
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {onCheck ? (
          <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)} className="accent-accent shrink-0" title={`Include ${label} in re-enrichment`} />
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        <span className="w-9 shrink-0 text-xs uppercase tracking-wider text-text-secondary">{label}</span>
        {chip !== null && <ConfidenceChip fc={chip ?? undefined} onSet={onSetChip} />}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {conflictLines && conflictLines.length > 0 && (
        <div className="ml-[21px] mt-0.5 space-y-0.5">
          {conflictLines.map((line, i) => (
            <p key={i} className="text-[11px] leading-snug bg-negative text-white px-1.5 py-0.5 inline-block">
              <Linkified text={line} />
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// All bio versions switchable in place — read, compare, activate without leaving the card
// Which DB column backs each bio tab (edits write to the shown version's column)
const BIO_COLUMN: Record<string, 'bio' | 'bio_festival' | 'bio_generated'> = {
  active: 'bio', festival: 'bio_festival', generated: 'bio_generated',
}

function BioBlock({ artist, checked, onCheck }: { artist: Artist; checked: boolean; onCheck: (v: boolean) => void }) {
  const activateBio = useActivateBio()
  const updateArtist = useUpdateArtist()
  const [tab, setTab] = useState('active')
  const versions = [
    { key: 'active', label: 'Active', content: artist.bio, activatable: false },
    { key: 'festival', label: 'Festival', content: artist.bio_festival, activatable: artist.bio_festival !== artist.bio, warning: artist.bio_research?.festival_bio_flagged ? 'contains festival name' : undefined },
    { key: 'generated', label: 'Generated', content: artist.bio_generated, activatable: artist.bio_generated !== artist.bio },
  ].filter(v => v.content)
  const current = versions.find(v => v.key === tab) ?? versions[0]

  return (
    <div className="flex-1 min-w-0 self-stretch flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)} className="accent-accent shrink-0" title="Include bio in re-enrichment" />
        <span className="text-xs uppercase tracking-wider text-text-secondary">Bio</span>
        {artist.bio_source && <span className="text-[10px] font-mono text-accent uppercase">{artist.bio_source}</span>}
        <span className="flex gap-0.5 ml-1">
          {versions.map(v => (
            <button
              key={v.key}
              className={`font-mono text-[10px] px-1.5 py-0.5 uppercase tracking-wider ${
                current?.key === v.key ? 'bg-accent text-surface font-bold' : 'text-text-secondary hover:text-accent border border-border'
              }`}
              onClick={() => setTab(v.key)}
            >
              {v.label}{v.warning ? ' ⚠' : ''}
            </button>
          ))}
        </span>
        {current?.activatable && (
          <button
            className="font-mono text-[10px] text-accent hover:underline uppercase tracking-wider font-bold"
            onClick={() => activateBio.mutate({ artistId: artist.id, source: current.key })}
          >
            Use this
          </button>
        )}
      </div>
      {current?.warning && <p className="font-mono text-[11px] bg-negative text-white px-1.5 py-0.5 inline-block">⚠ {current.warning}</p>}
      <InlineTextEdit
        value={current?.content ?? ''}
        className="flex-1 min-h-0 basis-0 overflow-y-auto pr-1"
        onSave={v => updateArtist.mutate({
          id: artist.id,
          [BIO_COLUMN[current?.key ?? 'active']]: v || null,
        } as Partial<Artist> & { id: string })}
      />
    </div>
  )
}

function ReviewCard({ artist, focused, selected, onSelect, onApprove, onFlag, onEnrich, cardRef }: {
  artist: Artist
  focused: boolean
  selected: boolean
  onSelect: (v: boolean) => void
  onApprove: () => void
  onFlag: () => void
  onEnrich: (fields: string[]) => void
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const updateArtist = useUpdateArtist()
  const updateAndRefetch = useUpdateAndRefetch()
  const [enrichFields, setEnrichFields] = useState<Set<string>>(new Set())
  const fc = artist.enrichment_confidence ?? {}

  function toggleField(field: string, v: boolean) {
    setEnrichFields(prev => {
      const next = new Set(prev)
      if (v) next.add(field)
      else next.delete(field)
      return next
    })
  }

  function saveField(field: string, confKey: string, value: string | number | null) {
    const updates = { [field]: value, enrichment_confidence: confirmField(artist, confKey) }
    // SC or Discogs handle changes re-fetch profile images into the carousel
    // server-side (update_and_refetch), so route those through the refetch path.
    const triggersRefetch =
      (field === 'soundcloud_url' && value && value !== artist.soundcloud_url) ||
      (field === 'discogs_id' && value && value !== artist.discogs_id)
    if (triggersRefetch) {
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

  function setConfidence(key: string, level: Level) {
    updateArtist.mutate({
      id: artist.id,
      enrichment_confidence: adminSetLevel(artist, key, level),
    } as Partial<Artist> & { id: string })
  }

  // Conflict evidence surfaces directly under the field it belongs to
  function conflictLines(key: string): string[] {
    return (fc[key]?.evidence ?? []).filter(e => e.includes('DIFFER') || e.includes('conflict'))
  }

  return (
    <div
      ref={cardRef}
      className={`border p-4 flex gap-4 transition-colors ${focused ? 'border-accent bg-surface-raised' : 'border-border'}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={e => onSelect(e.target.checked)}
        className="accent-accent self-start mt-1"
        title="Select for bulk enrichment"
      />

      <div className="shrink-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <input type="checkbox" checked={enrichFields.has('image')} onChange={e => toggleField('image', e.target.checked)} className="accent-accent" title="Include image in re-enrichment" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary">Image</span>
          <ConfidenceChip fc={fc.image} onSet={l => setConfidence('image', l)} />
        </div>
        <Carousel artist={artist} onPick={pickImage} />
      </div>

      <div className="w-72 shrink-0 space-y-1.5 font-mono text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/admin/artists/${artist.id}`} className="font-bold text-base text-white hover:text-accent transition-colors">
            {artist.name}
          </Link>
          <EnrichmentStatusBadge status={artist.enrichment_status} />
        </div>
        {artist.soundcloud_followers != null && (
          <p className="text-[11px] text-text-secondary">{artist.soundcloud_followers.toLocaleString()} SC followers</p>
        )}

        <FieldRow label="SC" chip={fc.soundcloud} checked={enrichFields.has('soundcloud')} onCheck={v => toggleField('soundcloud', v)} onSetChip={l => setConfidence('soundcloud', l)} conflictLines={conflictLines('soundcloud')}>
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
        <FieldRow label="IG" chip={fc.instagram} checked={enrichFields.has('instagram')} onCheck={v => toggleField('instagram', v)} onSetChip={l => setConfidence('instagram', l)} conflictLines={conflictLines('instagram')}>
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
        <FieldRow label="BC" chip={fc.bandcamp} checked={enrichFields.has('bandcamp')} onCheck={v => toggleField('bandcamp', v)} onSetChip={l => setConfidence('bandcamp', l)} conflictLines={conflictLines('bandcamp')}>
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
        <FieldRow label="DC" chip={fc.discogs} checked={enrichFields.has('discogs')} onCheck={v => toggleField('discogs', v)} onSetChip={l => setConfidence('discogs', l)} conflictLines={conflictLines('discogs')}>
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
        <FieldRow label="Loc" chip={fc.location} checked={enrichFields.has('location')} onCheck={v => toggleField('location', v)} onSetChip={l => setConfidence('location', l)}>
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

      <BioBlock artist={artist} checked={enrichFields.has('bio')} onCheck={v => toggleField('bio', v)} />

      <div className="shrink-0 flex flex-col gap-1.5 w-24">
        {artist.enrichment_status !== 'reviewed' && (
          <Button variant="secondary" fullWidth={false} className="!text-xs !px-2 !py-1.5" onClick={onApprove}>
            Approve
          </Button>
        )}
        {artist.enrichment_status !== 'flagged' && (
          <Button variant="secondary" fullWidth={false} className="!text-xs !px-2 !py-1.5 !bg-negative !text-white !border-negative" onClick={onFlag}>
            Flag
          </Button>
        )}
        <Button
          variant="secondary"
          fullWidth={false}
          className="!text-xs !px-2 !py-1.5"
          onClick={() => onEnrich([...enrichFields])}
          title={enrichFields.size > 0 ? `Re-enrich: ${[...enrichFields].join(', ')}` : 'Full enrichment'}
        >
          Enrich{enrichFields.size > 0 ? ` (${enrichFields.size})` : ''}
        </Button>
      </div>
    </div>
  )
}

export default function AdminEnrichmentReview() {
  const [filter, setFilter] = useState<FilterKey>('pending')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all')
  const [festivalId, setFestivalIdState] = useState(rememberedFestival)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(200)
  // Focus tracks the artist's ID, not a list index: approve/flag mutate the list
  // (the card leaves the queue), and an index would drift — the classic skip-two.
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkFields, setBulkFields] = useState<Set<string>>(new Set())
  const [searchKeywords, setSearchKeywords] = useState('')
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  function setFestivalId(v: string) {
    setFestivalIdState(v)
    rememberFestival(v)
  }

  const { data: festivals = [] } = useAdminFestivals()
  const { data: result, isLoading } = useAdminArtists({
    status: filter === 'candidates' ? undefined : filter,
    hasCandidates: filter === 'candidates' || undefined,
    festivalId: festivalId || undefined,
    search: search || undefined,
    limit: pageSize,
    offset: page * pageSize,
  })
  const updateArtist = useUpdateArtist()
  const approveArtists = useApproveArtists()
  const createJob = useCreateJob()

  const artists = (result?.data ?? []) as Artist[]

  const grouped = useMemo(() => {
    const byGroup = new Map<string, Artist[]>()
    for (const a of artists) {
      const g = aggregateLevel(a)
      if (confidenceFilter !== 'all' && g !== confidenceFilter) continue
      byGroup.set(g, [...(byGroup.get(g) ?? []), a])
    }
    // alphabetical within groups — server already orders by sort_name
    return GROUPS.map(g => ({ ...g, artists: byGroup.get(g.key) ?? [] })).filter(g => g.artists.length > 0)
  }, [artists, confidenceFilter])

  const flatList = useMemo(() => grouped.flatMap(g => g.artists), [grouped])

  // Resolve the focused artist to its current index; fall back to the first card
  // when nothing is focused or the focused artist has left the list.
  const focusPos = useMemo(() => {
    if (focusId) {
      const idx = flatList.findIndex(a => a.id === focusId)
      if (idx >= 0) return idx
    }
    return 0
  }, [focusId, flatList])
  const focusedId = flatList[focusPos]?.id ?? null

  const approve = useCallback((artist: Artist) => {
    approveArtists.mutate({ artistIds: [artist.id] })
  }, [approveArtists])

  const flag = useCallback((artist: Artist) => {
    updateArtist.mutate({ id: artist.id, enrichment_status: 'flagged' } as Partial<Artist> & { id: string })
  }, [updateArtist])

  function enrichOne(artist: Artist, fields: string[]) {
    createJob.mutate({
      type: 'enrich',
      artist_sort_names: [artist.sort_name],
      ...(fields.length > 0 && { fields }),
      ...(searchKeywords && { search_keywords: searchKeywords }),
    })
  }

  function enrichSelected() {
    const names = artists.filter(a => selected.has(a.id)).map(a => a.sort_name)
    if (names.length === 0) return
    createJob.mutate({
      type: 'enrich',
      artist_sort_names: names,
      ...(bulkFields.size > 0 && { fields: [...bulkFields] }),
      ...(searchKeywords && { search_keywords: searchKeywords }),
    })
    setSelected(new Set())
  }

  function toggleBulkField(field: string, v: boolean) {
    setBulkFields(prev => {
      const next = new Set(prev)
      if (v) next.add(field)
      else next.delete(field)
      return next
    })
  }

  const allSelected = flatList.length > 0 && flatList.every(a => selected.has(a.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(flatList.map(a => a.id)))
  }

  // Keyboard: K next, J previous (per Boss), A approve + advance, X flag + advance.
  // Focus advances by target ID captured before the action, so approve/flag (which
  // remove the card from the queue) land focus on the next card, never skipping one.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return  // ignore held-key auto-repeat (double-approve guard)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (flatList.length === 0) return
      const key = e.key.toLowerCase()
      const idx = focusPos
      if (key === 'k') {
        e.preventDefault()
        setFocusId(flatList[Math.min(idx + 1, flatList.length - 1)]?.id ?? null)
      } else if (key === 'j') {
        e.preventDefault()
        setFocusId(flatList[Math.max(idx - 1, 0)]?.id ?? null)
      } else if (key === 'a') {
        e.preventDefault()
        const artist = flatList[idx]
        if (artist) {
          const next = flatList[idx + 1] ?? flatList[idx - 1] ?? null
          approve(artist)
          setFocusId(next?.id ?? null)
        }
      } else if (key === 'x') {
        e.preventDefault()
        const artist = flatList[idx]
        if (artist) {
          const next = flatList[idx + 1] ?? flatList[idx - 1] ?? null
          flag(artist)
          setFocusId(next?.id ?? null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flatList, focusPos, approve, flag])

  useEffect(() => {
    const artist = flatList[focusPos]
    if (artist) {
      cardRefs.current.get(artist.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusPos, flatList])

  useEffect(() => { setFocusId(null) }, [filter, confidenceFilter, festivalId, search, page, pageSize])
  useEffect(() => { setPage(0) }, [filter, confidenceFilter, festivalId, search, pageSize])

  const totalCount = result?.count ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Heading variant="page">Enrichment Review</Heading>
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <Kbd>K</Kbd> next <Kbd>J</Kbd> prev <Kbd>A</Kbd> approve <Kbd>X</Kbd> flag
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-48">
          <Input placeholder="Search artists..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-0.5">
          {FILTERS.map(f => (
            <Button key={f.key} variant="segment" active={filter === f.key} fullWidth={false} className="px-3 py-1.5" onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-0.5">
          {CONFIDENCE_FILTERS.map(c => (
            <Button key={c} variant="segment" active={confidenceFilter === c} fullWidth={false} className="px-3 py-1.5" onClick={() => setConfidenceFilter(c)}>
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
        <span className="font-mono text-sm text-text-secondary">{flatList.length} of {totalCount} artists</span>
      </div>

      {/* Bulk enrichment bar */}
      <div className="flex items-center gap-3 flex-wrap font-mono text-sm border border-border px-3 py-2.5">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-accent" />
          <span className="text-text-secondary text-xs">{selected.size} selected</span>
        </label>
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
        <Button
          variant="accent-outline"
          fullWidth={false}
          className="!text-xs !px-3 !py-1"
          disabled={selected.size === 0 || createJob.isPending}
          onClick={enrichSelected}
          title={bulkFields.size > 0 ? `Fields: ${[...bulkFields].join(', ')}` : 'Full enrichment (no fields selected)'}
        >
          Enrich {selected.size > 0 ? selected.size : ''} {bulkFields.size > 0 ? `(${bulkFields.size} fields)` : '(full)'}
        </Button>
        {selected.size > 0 && (
          <button className="text-text-secondary hover:text-accent text-xs uppercase tracking-wider" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-text-secondary text-xs uppercase tracking-wider">Per page:</span>
          {PAGE_SIZES.map(s => (
            <button
              key={s}
              className={`text-xs px-1 ${pageSize === s ? 'text-accent font-bold' : 'text-text-secondary hover:text-accent'}`}
              onClick={() => setPageSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="font-mono text-sm text-text-secondary py-8 text-center">Loading...</p>
      ) : flatList.length === 0 ? (
        <p className="font-mono text-sm text-text-secondary py-8 text-center">Queue is empty.</p>
      ) : (
        grouped.map(group => (
          <section key={group.key} className="space-y-2">
            <div className="flex items-center gap-3 pt-2">
              <Badge variant={group.key === 'high' ? 'accent' : group.key === 'low' ? 'negative' : 'outline'}>
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
                  focused={a.id === focusedId}
                  selected={selected.has(a.id)}
                  onSelect={v => setSelected(prev => {
                    const next = new Set(prev)
                    if (v) next.add(a.id)
                    else next.delete(a.id)
                    return next
                  })}
                  onApprove={() => approve(a)}
                  onFlag={() => flag(a)}
                  onEnrich={fields => enrichOne(a, fields)}
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
