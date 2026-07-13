import { sleep } from '../../scrapers/base.js'

const MB_API = 'https://musicbrainz.org/ws/2'
// MusicBrainz requires a meaningful User-Agent and max 1 req/s
const MB_USER_AGENT = 'earrands/1.0 (https://earrands.app)'
const MB_RATE_MS = 1100

// Corroboration evidence only — MusicBrainz never supplies field values directly.
// Core data (entities + URL relations) is CC0; see docs/spikes/2026-07-enrichment-source-spike.md
export type MbEvidence = {
  mb_id: string
  name: string
  name_exact: boolean
  soundcloud_urls: string[]
  instagram_urls: string[]
  bandcamp_urls: string[]
  discogs_ids: number[]
}

type MbSearchResponse = {
  artists?: Array<{ id: string; name: string; score: number }>
}

type MbArtistResponse = {
  name?: string
  relations?: Array<{ url?: { resource?: string } }>
}

function normalize(url: string): string {
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
}

async function mbFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${MB_API}${path}`, {
    headers: { 'User-Agent': MB_USER_AGENT, Accept: 'application/json' },
  })
  if (res.status === 503 || res.status === 429) {
    throw new Error('MusicBrainz rate limit exceeded')
  }
  if (!res.ok) return null
  return res.json() as Promise<T>
}

export function extractMbEvidence(mbId: string, name: string, artistName: string, data: MbArtistResponse): MbEvidence {
  const urls = (data.relations ?? [])
    .map(r => r.url?.resource)
    .filter((u): u is string => !!u)
    .map(normalize)

  return {
    mb_id: mbId,
    name,
    name_exact: name.toLowerCase() === artistName.toLowerCase(),
    soundcloud_urls: urls.filter(u => u.startsWith('soundcloud.com/')),
    instagram_urls: urls.filter(u => u.startsWith('instagram.com/')),
    bandcamp_urls: urls.filter(u => u.includes('bandcamp.com')),
    discogs_ids: urls
      .map(u => u.match(/^discogs\.com\/artist\/(\d+)/)?.[1])
      .filter((id): id is string => !!id)
      .map(Number),
  }
}

export async function lookupMusicBrainzArtist(artistName: string): Promise<MbEvidence | null> {
  const search = await mbFetch<MbSearchResponse>(
    `/artist?query=artist:${encodeURIComponent(`"${artistName}"`)}&limit=1&fmt=json`,
  )
  await sleep(MB_RATE_MS)
  const top = search?.artists?.[0]
  // Search score is useless for disambiguation (wrong entities also score 100) —
  // a non-exact name match contributes no evidence, so skip the second request.
  if (!top || top.name.toLowerCase() !== artistName.toLowerCase()) return null

  const detail = await mbFetch<MbArtistResponse>(`/artist/${top.id}?inc=url-rels&fmt=json`)
  await sleep(MB_RATE_MS)
  if (!detail) return null

  return extractMbEvidence(top.id, top.name, artistName, detail)
}
