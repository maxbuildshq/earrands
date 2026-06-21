import { buildSearchQuery, isSoundCloudProfileUrl, isInstagramProfileUrl, normalizeSoundCloudUrl, normalizeUrl } from './name-utils.js'
import { sleep } from '../../scrapers/base.js'
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
  'soundcloud.com', 'instagram.com', 'spotify.com', 'linktr.ee',
  'facebook.com', 'twitter.com', 'x.com', 'ra.co', 'tiktok.com',
  'youtube.com', 'music.apple.com', 'deezer.com',
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
): Promise<string | null> {
  const query = buildSearchQuery(artistName, 'soundcloud.com')
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
): Promise<string | null> {
  const query = buildSearchQuery(artistName, 'instagram.com')
  const results = await braveSearch(query, apiKey)

  for (const result of results) {
    if (isInstagramProfileUrl(result.url)) {
      return normalizeUrl(result.url)
    }
  }
  return null
}

export async function searchArtistBio(
  artistName: string,
  apiKey: string,
  fetchPages = true,
): Promise<BioSource[]> {
  const excludeSites = EXCLUDED_DOMAINS.map(d => `-site:${d}`).join(' ')
  const query = `"${artistName}" biography electronic music DJ ${excludeSites}`
  const results = await braveSearch(query, apiKey)

  const sources: BioSource[] = []

  // Filter out excluded domains (belt-and-suspenders — search exclusions aren't always perfect)
  const validResults = results.filter(r => !isExcludedDomain(r.url))

  for (const result of validResults.slice(0, 5)) {
    const source: BioSource = {
      url: result.url,
      title: result.title.replace(/<[^>]+>/g, ''),
      snippet: result.description.replace(/<[^>]+>/g, ''),
      type: 'web',
    }

    if (fetchPages && sources.filter(s => s.content).length < 3) {
      try {
        await sleep(500)
        const res = await fetch(result.url, {
          headers: { 'User-Agent': 'Earrands/1.0 (festival app)' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const html = await res.text()
          const text = extractTextFromHtml(html)
          if (text.length > 100) {
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
): Promise<BraveResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: '5',
  })

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
