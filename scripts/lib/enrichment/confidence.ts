import type { Confidence, CrossLink, FieldConfidence } from './types.js'
import type { MbEvidence } from './musicbrainz.js'
import { extractInstagramHandle } from './name-utils.js'

// Everything the graph resolver learned about one artist, source by source.
// Pure input — no fetching here, so the tree is unit-testable with fixtures.
export type ResolutionEvidence = {
  soundcloud_url: string | null
  sc_source: 'db' | 'brave' | 'discogs' | null
  instagram_url: string | null
  ig_source: string | null
  ig_agreeing_sources: string[]
  ig_conflict: boolean
  bandcamp_url: string | null
  bc_source: string | null
  discogs_id: number | null
  discogs_links_sc: boolean
  discogs_links_ig: boolean
  discogs_links_bc: boolean
  discogs_conflicts_sc: boolean
  // Conflicting URLs ride along so evidence strings are actionable in the admin UI
  discogs_sc_url?: string | null
  brave_sc_url?: string | null
  brave_sc_agrees?: boolean
  brave_sc_conflict?: boolean
  city: string | null
  location_source: string | null
  soundcloud_followers: number | null
  mb: MbEvidence | null
}

function normalize(url: string | null): string {
  return (url ?? '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
}

function mbLinksUrl(mb: MbEvidence | null, urls: string[], target: string | null): boolean {
  if (!mb || !target) return false
  const t = normalize(target)
  return urls.some(u => u === t || t.endsWith(u) || u.endsWith(t))
}

function mbLinksIg(mb: MbEvidence | null, target: string | null): boolean {
  if (!mb || !target) return false
  const handle = extractInstagramHandle(target)?.toLowerCase()
  if (!handle) return false
  return mb.instagram_urls.some(u => extractInstagramHandle(`https://${u}`)?.toLowerCase() === handle)
}

// Compact link targets for the structured crosslink rows in the admin tooltip
const discogsArtistUrl = (id: number) => `https://www.discogs.com/artist/${id}`
const mbArtistUrl = (id: string) => `https://musicbrainz.org/artist/${id}`
const urlHandle = (url: string | null | undefined) =>
  (url ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').split('/').pop() ?? ''
const bcHandle = (url: string | null | undefined) =>
  normalize(url ?? null).split('.bandcamp.com')[0]

export function computeFieldConfidence(e: ResolutionEvidence): Record<string, FieldConfidence> {
  const fc: Record<string, FieldConfidence> = {}

  const mbFrom = e.mb ? { from: 'musicbrainz' as const, from_id: e.mb.mb_id.slice(0, 8), from_url: mbArtistUrl(e.mb.mb_id) } : null
  const dcFrom = e.discogs_id != null ? { from: 'discogs' as const, from_id: String(e.discogs_id), from_url: discogsArtistUrl(e.discogs_id) } : null
  const scTo = e.soundcloud_url ? { to: 'soundcloud' as const, to_handle: urlHandle(e.soundcloud_url), to_url: e.soundcloud_url } : null

  // ── soundcloud_url — the root node ─────────────────────────────────────────
  if (e.soundcloud_url) {
    const evidence: string[] = [e.sc_source === 'db' ? 'existing value' : `found via ${e.sc_source}`]
    const crosslinks: CrossLink[] = []
    let corroborated = false
    if (mbLinksUrl(e.mb, e.mb?.soundcloud_urls ?? [], e.soundcloud_url)) {
      corroborated = true
      evidence.push('musicbrainz entity links same SoundCloud')
      if (mbFrom && scTo) crosslinks.push({ ...mbFrom, ...scTo, agrees: true })
    }
    if (e.discogs_links_sc && e.sc_source !== 'discogs') {
      corroborated = true
      evidence.push('discogs page links same SoundCloud')
      if (dcFrom && scTo) crosslinks.push({ ...dcFrom, ...scTo, agrees: true })
    }
    // Brave agreement is evidence-only (search results aren't cross-links); a
    // conflict on an uncorroborated value drags it to low for review priority.
    if (e.brave_sc_agrees) evidence.push('brave search agrees')
    if (e.brave_sc_conflict) {
      evidence.push(`brave search top result DIFFERS${e.brave_sc_url ? `: ${e.brave_sc_url}` : ''}`)
      if (e.brave_sc_url) crosslinks.push({ from: 'brave', from_id: 'search', from_url: e.brave_sc_url, to: 'soundcloud', to_handle: urlHandle(e.brave_sc_url), to_url: e.brave_sc_url, agrees: false })
    }
    const level: Confidence = corroborated ? 'high' : e.brave_sc_conflict ? 'low' : 'medium'
    fc.soundcloud = { level, evidence, ...(crosslinks.length ? { crosslinks } : {}) }
  } else {
    fc.soundcloud = { level: 'low', evidence: ['not found'] }
  }
  const scLevel = fc.soundcloud.level

  // ── discogs_id ─────────────────────────────────────────────────────────────
  if (e.discogs_id != null) {
    const evidence: string[] = []
    const crosslinks: CrossLink[] = []
    if (e.mb?.discogs_ids.includes(e.discogs_id)) {
      evidence.push('musicbrainz entity links same Discogs ID')
      if (mbFrom) crosslinks.push({ ...mbFrom, to: 'discogs', to_handle: String(e.discogs_id), to_url: discogsArtistUrl(e.discogs_id), agrees: true })
    }
    if (e.discogs_links_sc) {
      evidence.push('discogs page links our SoundCloud')
      if (dcFrom && scTo) crosslinks.push({ ...dcFrom, ...scTo, agrees: true })
    }
    if (e.discogs_links_ig) {
      evidence.push('discogs page links our Instagram')
      if (dcFrom && e.instagram_url) crosslinks.push({ ...dcFrom, to: 'instagram', to_handle: extractInstagramHandle(e.instagram_url) ?? urlHandle(e.instagram_url), to_url: e.instagram_url, agrees: true })
    }
    if (e.discogs_links_bc) {
      evidence.push('discogs page links our Bandcamp')
      if (dcFrom && e.bandcamp_url) crosslinks.push({ ...dcFrom, to: 'bandcamp', to_handle: bcHandle(e.bandcamp_url), to_url: e.bandcamp_url, agrees: true })
    }
    if (e.discogs_conflicts_sc) {
      if (dcFrom && e.discogs_sc_url) crosslinks.push({ ...dcFrom, to: 'soundcloud', to_handle: urlHandle(e.discogs_sc_url), to_url: e.discogs_sc_url, agrees: false })
      fc.discogs = { level: 'low', evidence: [`discogs page links a DIFFERENT SoundCloud than ours${e.discogs_sc_url ? `: ${e.discogs_sc_url}` : ''}`, ...evidence], ...(crosslinks.length ? { crosslinks } : {}) }
    } else if (evidence.length > 0) {
      fc.discogs = { level: 'high', evidence, ...(crosslinks.length ? { crosslinks } : {}) }
    } else {
      fc.discogs = { level: 'medium', evidence: ['name-only match, no cross-link either way'] }
    }
  } else {
    fc.discogs = { level: 'low', evidence: ['not found'] }
  }

  // ── instagram_url — artist-asserted content, identity confidence only ──────
  if (e.instagram_url) {
    const evidence = [`from ${e.ig_source}`]
    const igTo = { to: 'instagram' as const, to_handle: extractInstagramHandle(e.instagram_url) ?? urlHandle(e.instagram_url), to_url: e.instagram_url }
    const crosslinks: CrossLink[] = []
    const mbAgrees = mbLinksIg(e.mb, e.instagram_url)
    if (mbAgrees) {
      evidence.push('musicbrainz entity links same Instagram')
      if (mbFrom) crosslinks.push({ ...mbFrom, ...igTo, agrees: true })
    }
    const cl = crosslinks.length ? { crosslinks } : {}
    const agreeing = e.ig_agreeing_sources.length + (mbAgrees ? 1 : 0)
    if (e.ig_conflict) {
      fc.instagram = { level: 'low', evidence: [...evidence, 'sources conflict'], ...cl }
    } else if (e.ig_source === 'soundcloud-instagram') {
      // SC profile link inherits SC identity confidence (artist-asserted content)
      fc.instagram = { level: scLevel, evidence: [...evidence, `inherits SoundCloud identity (${scLevel})`], ...cl }
    } else if (agreeing >= 2) {
      fc.instagram = { level: 'high', evidence: [...evidence, `${agreeing} sources agree`], ...cl }
    } else {
      fc.instagram = { level: 'medium', evidence: [...evidence, 'single source'], ...cl }
    }
  } else {
    fc.instagram = { level: 'low', evidence: ['not found'] }
  }

  // ── bandcamp_url — a trusted SC profile link alone is enough for high ──────
  if (e.bandcamp_url) {
    const evidence = [`from ${e.bc_source}`]
    const bcTo = { to: 'bandcamp' as const, to_handle: bcHandle(e.bandcamp_url), to_url: e.bandcamp_url }
    const crosslinks: CrossLink[] = []
    const mbAgrees = mbLinksUrl(e.mb, e.mb?.bandcamp_urls ?? [], e.bandcamp_url)
    if (mbAgrees) {
      evidence.push('musicbrainz entity links same Bandcamp')
      if (mbFrom) crosslinks.push({ ...mbFrom, ...bcTo, agrees: true })
    }
    if (e.discogs_links_bc && dcFrom) crosslinks.push({ ...dcFrom, ...bcTo, agrees: true })
    const cl = crosslinks.length ? { crosslinks } : {}
    if (e.bc_source === 'soundcloud-bandcamp') {
      fc.bandcamp = { level: scLevel, evidence: [...evidence, `inherits SoundCloud identity (${scLevel})`], ...cl }
    } else if (mbAgrees || e.discogs_links_bc) {
      fc.bandcamp = { level: 'high', evidence: [...evidence, 'independently corroborated'], ...cl }
    } else {
      fc.bandcamp = { level: 'medium', evidence: [...evidence, 'single source'], ...cl }
    }
  } else {
    fc.bandcamp = { level: 'low', evidence: ['not found'] }
  }

  // ── location — artist-asserted, often partial; never above medium ──────────
  if (e.city) {
    fc.location = { level: scLevel === 'low' ? 'low' : 'medium', evidence: [`from ${e.location_source}`, 'artist-asserted content'] }
  } else {
    fc.location = { level: 'low', evidence: ['not found'] }
  }

  // ── followers — platform-derived, tracks SC identity confidence ────────────
  if (e.soundcloud_followers != null) {
    fc.followers = { level: scLevel, evidence: ['platform-derived from SoundCloud profile'] }
  }

  return fc
}

// Candidate/winner image confidence follows the identity confidence of the
// source it came from — never used to exclude, only to rank and label.
export function imageSourceConfidence(
  source: string,
  fc: Record<string, FieldConfidence>,
): Confidence {
  if (source.startsWith('soundcloud')) return fc.soundcloud?.level ?? 'low'
  if (source.startsWith('discogs')) return fc.discogs?.level ?? 'low'
  return 'low'
}

const TIER_WEIGHT: Record<Confidence, number> = { high: 2, medium: 1, low: 0 }

export function tierWeight(level: Confidence): number {
  return TIER_WEIGHT[level]
}

// Winner pre-selection rank: confidence tier first; within a tier the SC avatar
// wins (usually most up-to-date, and the SC profile is the identity target);
// DETR score breaks remaining ties. Ranking only — candidates are never excluded.
export function rankImageCandidate(c: { source: string; score: number; confidence?: Confidence }): number {
  return tierWeight(c.confidence ?? 'low') * 1000 + (c.source.startsWith('soundcloud') ? 500 : 0) + Math.min(c.score, 499)
}
