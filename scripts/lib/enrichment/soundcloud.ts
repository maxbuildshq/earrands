import { fetchWithCheerio } from '../../scrapers/base.js'
import { normalizeUrl } from './name-utils.js'

export type SoundCloudProfile = {
  image_url: string | null
  instagram_url: string | null
  bandcamp_url: string | null
  website_url: string | null
  track_urls: string[]
}

export async function scrapeSoundCloudProfile(profileUrl: string): Promise<SoundCloudProfile | null> {
  try {
    const $ = await fetchWithCheerio(profileUrl)

    const image_url = extractProfileImage($)
    const links = extractProfileLinks($)
    const track_urls = extractTrackUrls($, profileUrl)

    return {
      image_url,
      instagram_url: links.instagram,
      bandcamp_url: links.bandcamp,
      website_url: links.website,
      track_urls,
    }
  } catch {
    return null
  }
}

function extractProfileImage($: ReturnType<typeof fetchWithCheerio> extends Promise<infer T> ? T : never): string | null {
  const avatar = $('img[src*="sndcdn.com/avatars"]').first().attr('src')
  if (avatar) {
    return avatar.replace(/-large\./, '-t500x500.')
  }

  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage && ogImage.includes('sndcdn.com')) {
    return ogImage
  }

  return null
}

function extractProfileLinks($: ReturnType<typeof fetchWithCheerio> extends Promise<infer T> ? T : never): {
  instagram: string | null
  bandcamp: string | null
  website: string | null
} {
  let instagram: string | null = null
  let bandcamp: string | null = null
  let website: string | null = null

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const resolved = resolveRedirect(href)

    if (resolved.includes('instagram.com/') && !instagram) {
      instagram = normalizeUrl(resolved)
    }
    if (resolved.includes('bandcamp.com') && !bandcamp) {
      bandcamp = normalizeUrl(resolved)
    }
    if (!resolved.includes('soundcloud.com') &&
        !resolved.includes('instagram.com') &&
        !resolved.includes('bandcamp.com') &&
        !resolved.includes('facebook.com') &&
        !resolved.includes('twitter.com') &&
        !resolved.includes('x.com') &&
        !website &&
        (resolved.startsWith('http://') || resolved.startsWith('https://'))) {
      website = resolved
    }
  })

  return { instagram, bandcamp, website }
}

function resolveRedirect(href: string): string {
  if (href.includes('gate.sc/') || href.includes('exit.sc/')) {
    try {
      const url = new URL(href)
      return url.searchParams.get('url') ?? href
    } catch {
      return href
    }
  }
  return href
}

function extractTrackUrls(
  $: ReturnType<typeof fetchWithCheerio> extends Promise<infer T> ? T : never,
  profileUrl: string,
): string[] {
  const urls: string[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const full = href.startsWith('/') ? `https://soundcloud.com${href}` : href
    if (full.startsWith(profileUrl + '/') && !full.includes('/sets/') && !full.includes('/likes') && !full.includes('/followers') && !full.includes('/following') && !full.includes('/reposts') && !full.includes('/comments')) {
      const parts = new URL(full).pathname.split('/').filter(Boolean)
      if (parts.length === 2 && !urls.includes(full)) {
        urls.push(full)
      }
    }
  })

  return urls.slice(0, 5)
}

export type OEmbedResult = {
  html: string
  title: string
  author_name: string
  thumbnail_url: string | null
}

export async function validateWithOEmbed(url: string): Promise<OEmbedResult | null> {
  try {
    const params = new URLSearchParams({ url, format: 'json' })
    const res = await fetch(`https://soundcloud.com/oembed?${params}`)
    if (!res.ok) return null
    const data = await res.json() as OEmbedResult
    return data
  } catch {
    return null
  }
}

export async function findBestTrack(profileUrl: string, trackUrls: string[]): Promise<string | null> {
  for (const url of trackUrls) {
    const oembed = await validateWithOEmbed(url)
    if (oembed) return url
  }
  return null
}
