import { buildSearchQuery, isSoundCloudProfileUrl, isInstagramProfileUrl, normalizeUrl } from './name-utils.js'
import { sleep } from '../../scrapers/base.js'

const GOOGLE_API_URL = 'https://www.googleapis.com/customsearch/v1'

type SearchResult = {
  link: string
  title: string
  snippet: string
}

export async function searchSoundCloud(
  artistName: string,
  apiKey: string,
  cseId: string,
): Promise<string | null> {
  const query = buildSearchQuery(artistName, 'soundcloud.com')
  const results = await googleSearch(query, apiKey, cseId)

  for (const result of results) {
    if (isSoundCloudProfileUrl(result.link)) {
      return normalizeUrl(result.link)
    }
  }
  return null
}

export async function searchInstagram(
  artistName: string,
  apiKey: string,
  cseId: string,
): Promise<string | null> {
  const query = buildSearchQuery(artistName, 'instagram.com')
  const results = await googleSearch(query, apiKey, cseId)

  for (const result of results) {
    if (isInstagramProfileUrl(result.link)) {
      return normalizeUrl(result.link)
    }
  }
  return null
}

async function googleSearch(
  query: string,
  apiKey: string,
  cseId: string,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: '5',
  })

  const res = await fetch(`${GOOGLE_API_URL}?${params}`)
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Google Custom Search daily quota exceeded (100/day free tier)')
    }
    throw new Error(`Google Search API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as { items?: SearchResult[] }
  return data.items ?? []
}
