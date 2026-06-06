import { buildSearchQuery, isSoundCloudProfileUrl, isInstagramProfileUrl, normalizeSoundCloudUrl, normalizeUrl } from './name-utils.js'

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search'

type BraveResult = {
  url: string
  title: string
  description: string
}

type BraveResponse = {
  web?: { results?: BraveResult[] }
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
