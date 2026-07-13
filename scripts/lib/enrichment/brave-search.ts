import { buildSearchQuery, isSoundCloudProfileUrl, isInstagramProfileUrl, normalizeSoundCloudUrl, normalizeUrl } from './name-utils.js'
import { sleep } from '../../scrapers/base.js'
import { recordUsage } from './rate-limit.js'
import type { BioSource } from './types.js'

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search'

type BraveResult = {
  url: string
  title: string
  description: string
}

type BraveResponse = {
  web?: { results?: BraveResult[] }
}

const EXCLUDED_DOMAINS = [
  'soundcloud.com', 'instagram.com', 'linktr.ee',
  'facebook.com', 'twitter.com', 'x.com', 'tiktok.com',
  'youtube.com', 'music.apple.com', 'deezer.com',
  // Junk aggregators with no original bio content
  'songfromlink.com', 'tunefind.com', 'last.fm', 'musicbrainz.org',
  'allmusic.com', 'setlist.fm', '1001tracklists.com', 'beatport.com',
  'traxsource.com', 'bandsintown.com', 'songkick.com', 'genius.com',
]

function isExcludedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return EXCLUDED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))
  } catch {
    return false
  }
}

export async function searchSoundCloud(
  artistName: string,
  apiKey: string,
  searchKeywords?: string | null,
): Promise<string | null> {
  const query = buildSearchQuery(artistName, 'soundcloud.com', searchKeywords)
  const results = await braveSearch(query, apiKey)

  for (const result of results) {
    if (isSoundCloudProfileUrl(result.url)) {
      return normalizeSoundCloudUrl(result.url)
    }
  }
  return null
}

export async function searchInstagram(
  artistName: string,
  apiKey: string,
  searchKeywords?: string | null,
): Promise<string | null> {
  const query = buildSearchQuery(artistName, 'instagram.com', searchKeywords)
  const results = await braveSearch(query, apiKey)

  for (const result of results) {
    if (isInstagramProfileUrl(result.url)) {
      return normalizeUrl(result.url)
    }
  }
  return null
}

// Only a small set in the query string — Brave rejects long queries (422).
// The full EXCLUDED_DOMAINS list handles the rest client-side via isExcludedDomain().
const BIO_QUERY_EXCLUSIONS = [
  'soundcloud.com', 'instagram.com', 'youtube.com',
]

export async function searchArtistBio(
  artistName: string,
  apiKey: string,
  fetchPages = true,
  searchKeywords?: string | null,
): Promise<BioSource[]> {
  const excludeSites = BIO_QUERY_EXCLUSIONS.map(d => `-site:${d}`).join(' ')
  const kw = searchKeywords?.trim()
  const query = `"${artistName}"${kw ? ` ${kw}` : ''} biography electronic music DJ ${excludeSites}`
  const results = await braveSearch(query, apiKey, 10)

  const sources: BioSource[] = []

  // Filter out excluded domains (belt-and-suspenders — search exclusions aren't always perfect)
  const validResults = results.filter(r => !isExcludedDomain(r.url))

  // Normalise artist name for content relevance check (lowercase, strip punctuation)
  const artistNameNorm = artistName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const artistTokens = artistNameNorm.split(/\s+/).filter(t => t.length > 1)

  function contentMentionsArtist(text: string): boolean {
    if (artistTokens.length === 0) return true
    const norm = text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
    return artistTokens.every(t => norm.includes(t))
  }

  for (const result of validResults.slice(0, 10)) {
    if (sources.filter(s => s.content).length >= 5) break

    const source: BioSource = {
      url: result.url,
      title: result.title.replace(/<[^>]+>/g, ''),
      snippet: result.description.replace(/<[^>]+>/g, ''),
      type: 'web',
    }

    if (fetchPages) {
      try {
        await sleep(500)
        const res = await fetch(result.url, {
          headers: { 'User-Agent': 'Earrands/1.0 (festival app)' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const html = await res.text()
          const text = extractTextFromHtml(html)
          if (text.length > 200 && contentMentionsArtist(text)) {
            source.content = text.slice(0, 5000)
          }
        }
      } catch {}
    }

    sources.push(source)
  }

  return sources
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function braveSearch(
  query: string,
  apiKey: string,
  count = 5,
): Promise<BraveResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(count),
  })

  recordUsage('brave')
  const res = await fetch(`${BRAVE_API_URL}?${params}`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Brave Search rate limit exceeded — try again later')
    }
    throw new Error(`Brave Search API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as BraveResponse
  return data.web?.results ?? []
}
