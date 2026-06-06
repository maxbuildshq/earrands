import { sleep } from '../../scrapers/base.js'
import { normalizeUrl, normalizeSoundCloudUrl } from './name-utils.js'

const DISCOGS_API = 'https://api.discogs.com'

export type DiscogsArtistResult = {
  discogs_id: number
  image_url: string | null
  instagram_url: string | null
  soundcloud_url: string | null
  bandcamp_url: string | null
}

export async function searchDiscogsArtist(
  artistName: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<DiscogsArtistResult | null> {
  const params = new URLSearchParams({
    q: artistName,
    type: 'artist',
    per_page: '5',
  })

  const res = await fetch(`${DISCOGS_API}/database/search?${params}`, {
    headers: {
      'Authorization': `Discogs key=${consumerKey}, secret=${consumerSecret}`,
      'User-Agent': 'FestivalPulse/1.0',
    },
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Discogs rate limit exceeded (60/min)')
    }
    return null
  }

  const data = await res.json() as { results?: Array<{ id: number; title: string }> }
  const results = data.results ?? []

  if (results.length === 0) return null

  const bestMatch = results[0]
  return fetchDiscogsArtist(bestMatch.id, consumerKey, consumerSecret)
}

async function fetchDiscogsArtist(
  artistId: number,
  consumerKey: string,
  consumerSecret: string,
): Promise<DiscogsArtistResult | null> {
  await sleep(1000)

  const res = await fetch(`${DISCOGS_API}/artists/${artistId}`, {
    headers: {
      'Authorization': `Discogs key=${consumerKey}, secret=${consumerSecret}`,
      'User-Agent': 'FestivalPulse/1.0',
    },
  })

  if (!res.ok) return null

  const data = await res.json() as {
    id: number
    images?: Array<{ type: string; uri: string; uri150: string }>
    urls?: string[]
  }

  const primaryImage = data.images?.find(img => img.type === 'primary')
  const anyImage = data.images?.[0]
  const image_url = primaryImage?.uri ?? anyImage?.uri ?? null

  let instagram_url: string | null = null
  let soundcloud_url: string | null = null
  let bandcamp_url: string | null = null

  for (const url of data.urls ?? []) {
    if (url.includes('instagram.com/') && !instagram_url) {
      instagram_url = normalizeUrl(url)
    }
    if (url.includes('soundcloud.com/') && !soundcloud_url) {
      soundcloud_url = normalizeSoundCloudUrl(url)
    }
    if (url.includes('bandcamp.com') && !bandcamp_url) {
      bandcamp_url = normalizeUrl(url)
    }
  }

  return {
    discogs_id: data.id,
    image_url,
    instagram_url,
    soundcloud_url,
    bandcamp_url,
  }
}
