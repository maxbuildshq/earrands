import { fetchWithCheerio, getBrowser } from '../../scrapers/base.js'
import { normalizeUrl } from './name-utils.js'

export type SoundCloudProfile = {
  image_url: string | null
  instagram_url: string | null
  bandcamp_url: string | null
  website_url: string | null
  track_urls: string[]
  city: string | null
  country_code: string | null
  bio: string | null
  followers_count: number | null
}

type WebProfile = {
  url: string
  network: string
  title: string
  username?: string
}

export async function scrapeSoundCloudProfile(profileUrl: string): Promise<SoundCloudProfile | null> {
  try {
    // Fetch static HTML for the image (og:image is in SSR HTML)
    const $ = await fetchWithCheerio(profileUrl)
    const image_url = extractProfileImage($)
    const track_urls = extractTrackUrls($, profileUrl)
    const { city, country_code, bio, followers_count } = extractHydrationData($)

    // Use Playwright to intercept the web-profiles API call — social links are not in SSR HTML
    const webProfiles = await fetchWebProfiles(profileUrl)
    const links = extractLinksFromWebProfiles(webProfiles)

    return {
      image_url,
      instagram_url: links.instagram,
      bandcamp_url: links.bandcamp,
      website_url: links.website,
      track_urls,
      city,
      country_code,
      bio,
      followers_count,
    }
  } catch {
    return null
  }
}

async function fetchWebProfiles(profileUrl: string): Promise<WebProfile[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    let profiles: WebProfile[] = []

    page.on('response', async res => {
      if (res.url().includes('/web-profiles')) {
        try {
          profiles = await res.json() as WebProfile[]
        } catch {}
      }
    })

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait for the web-profiles API call to complete
    await page.waitForTimeout(3000)
    return profiles
  } finally {
    await page.close()
  }
}

function extractLinksFromWebProfiles(profiles: WebProfile[]): {
  instagram: string | null
  bandcamp: string | null
  website: string | null
} {
  let instagram: string | null = null
  let bandcamp: string | null = null
  let website: string | null = null

  for (const profile of profiles) {
    const url = profile.url
    if (!url || !url.startsWith('http')) continue

    const normalized = normalizeUrl(url)

    if (profile.network === 'instagram' && !instagram) {
      instagram = normalized
      continue
    }
    if (url.includes('bandcamp.com') && !bandcamp) {
      bandcamp = normalized
      continue
    }
    // Capture first personal/other link as website (skip known noise)
    if (!website &&
        !url.includes('soundcloud.com') &&
        !url.includes('instagram.com') &&
        !url.includes('bandcamp.com') &&
        !url.includes('facebook.com') &&
        !url.includes('twitter.com') &&
        !url.includes('x.com')) {
      website = normalized
    }
  }

  return { instagram, bandcamp, website }
}

type CheerioRoot = ReturnType<typeof fetchWithCheerio> extends Promise<infer T> ? T : never

function extractHydrationData($: CheerioRoot): { city: string | null; country_code: string | null; bio: string | null; followers_count: number | null } {
  let city: string | null = null
  let country_code: string | null = null
  let bio: string | null = null
  let followers_count: number | null = null

  $('script').each((_, el) => {
    const text = $(el).html()
    if (!text?.includes('__sc_hydration')) return
    const match = text.match(/__sc_hydration\s*=\s*(\[.*\])/)
    if (!match) return

    try {
      const hydration = JSON.parse(match[1]) as Array<{ hydratable: string; data: any }>
      const userEntry = hydration.find(h => h.hydratable === 'user')
      if (userEntry?.data) {
        city = userEntry.data.city || null
        country_code = userEntry.data.country_code || null
        bio = userEntry.data.description || null
        followers_count = typeof userEntry.data.followers_count === 'number' ? userEntry.data.followers_count : null
      }
    } catch {}
  })

  return { city, country_code, bio, followers_count }
}

function extractProfileImage($: CheerioRoot): string | null {
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

function extractTrackUrls(
  $: CheerioRoot,
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
