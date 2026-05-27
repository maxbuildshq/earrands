import type { ScrapedData, ScrapedSet, ScrapedStage, ScrapedArtist } from './types.js'
import { fetchNuxtData, generateSlug } from './base.js'

export type NuxtTimeslot = {
  slug: string
  name: string
  content: string | null
  location: { slug: string; name: string } | null
  venue: { slug: string; name: string } | null
  atDawnByNight: { slug: string; name: string } | null
  timeStart: string | null
  timeEnd: string | null
  showTime: boolean
  artist: { slug: string; name: string; content: string | null } | null
}

type NuxtArtist = {
  slug: string
  name: string
  content: string | null
  timeslots: NuxtTimeslot[]
  artist: { slug: string; name: string; content: string | null } | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseIsoTime(iso: string): { day: string; time: string } {
  // "2026-08-02T17:30:00.7200Z" → day="2026-08-02", time="17:30"
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!match) throw new Error(`Cannot parse ISO time: "${iso}"`)
  return { day: match[1], time: `${match[2]}:${match[3]}` }
}

export function extractLiveStatus(name: string): { artistName: string; isLive: boolean } {
  // "Artist Live" at the end
  const liveEndMatch = name.match(/^(.+?)\s+live$/i)
  if (liveEndMatch) return { artistName: liveEndMatch[1].trim(), isLive: true }

  // "Artist (live)" at the end
  const liveParenMatch = name.match(/^(.+?)\s+\(live\)$/i)
  if (liveParenMatch) return { artistName: liveParenMatch[1].trim(), isLive: true }

  // "Artist Live (members...)" or "Artist Live w/ ..." — Live before a qualifier
  const liveMidMatch = name.match(/^(.+?)\s+live\s+([\(w].*)/i)
  if (liveMidMatch) return { artistName: `${liveMidMatch[1].trim()} ${liveMidMatch[2].trim()}`, isLive: true }

  return { artistName: name, isLive: false }
}

export function getStageName(ts: NuxtTimeslot): string | null {
  if (!ts.location) return null

  if (ts.location.slug === 'into-the-city') {
    return ts.venue?.name ?? 'Into The City'
  }

  const sub = ts.atDawnByNight?.name ?? 'By Day'
  return `Amsterdamse Bos — ${sub}`
}

function findArtistList(nuxtData: Record<string, any>): NuxtArtist[] {
  for (const key of Object.keys(nuxtData)) {
    const entry = nuxtData[key]
    if (!entry || typeof entry !== 'object') continue

    if (entry.components && Array.isArray(entry.components)) {
      const artistList = entry.components.find(
        (c: any) => c.type === 'ArtistList' && c.data?.artists,
      )
      if (artistList) return artistList.data.artists
    }
  }
  throw new Error('Could not find ArtistList component in Nuxt data')
}

export async function scrapeDekmantel(url: string): Promise<ScrapedData> {
  console.log(`Fetching ${url}...`)
  const nuxtData = await fetchNuxtData(url)

  const nuxtArtists = findArtistList(nuxtData)
  console.log(`Found ${nuxtArtists.length} artists in Nuxt payload`)

  const stageNames = new Set<string>()
  const stages: ScrapedStage[] = []
  const sets: ScrapedSet[] = []
  const artists: ScrapedArtist[] = []
  let earliestDay = '9999-99-99'
  let latestDay = '0000-00-00'

  for (const nuxtArtist of nuxtArtists) {
    const ts = nuxtArtist.timeslots?.[0]
    if (!ts) continue

    const rawName = nuxtArtist.name.replace(/\s+/g, ' ').trim()
    const { artistName, isLive } = extractLiveStatus(rawName)
    const stageName = getStageName(ts)

    if (stageName && !stageNames.has(stageName)) {
      stageNames.add(stageName)
      stages.push({ name: stageName, sort_order: stages.length + 1 })
    }

    let day: string
    let startTime: string | null = null
    let endTime: string | null = null

    if (ts.timeStart && ts.timeStart.includes('T')) {
      const start = parseIsoTime(ts.timeStart)
      day = start.day
      if (ts.showTime) {
        startTime = start.time
        endTime = ts.timeEnd ? parseIsoTime(ts.timeEnd).time : null
      }
    } else if (ts.timestamp) {
      const d = new Date(Number(ts.timestamp) * 1000)
      day = d.toISOString().split('T')[0]
    } else {
      console.warn(`  Skipping ${nuxtArtist.name}: no date information`)
      continue
    }

    if (day < earliestDay) earliestDay = day
    if (day > latestDay) latestDay = day

    sets.push({
      artist_name: artistName,
      stage: stageName,
      day,
      start_time: startTime,
      end_time: endTime,
      is_live: isLive,
    })

    // Extract bio from timeslot content or artist sub-object
    const bioHtml = ts.content || nuxtArtist.content || nuxtArtist.artist?.content
    const bio = bioHtml ? stripHtml(bioHtml) : null

    artists.push({
      name: artistName.toLowerCase(),
      bio: bio && bio.length > 20 ? bio : null,
      source_url: `https://dekmantelfestival.com/artists/${nuxtArtist.slug}`,
    })
  }

  // Sort stages: ITC venues first (alphabetical), then By Day, then At Dawn
  const stageOrder: Record<string, number> = {
    'Melkweg': 1, 'Oude Kerk': 2, 'Paradiso': 3,
    'Amsterdamse Bos — By Day': 4, 'Amsterdamse Bos — At Dawn': 5,
  }
  stages.sort((a, b) => (stageOrder[a.name] ?? 99) - (stageOrder[b.name] ?? 99))
  stages.forEach((s, i) => { s.sort_order = i + 1 })

  const festival = {
    name: 'Dekmantel 2026',
    slug: 'dekmantel-2026',
    location: 'Amsterdamse Bos, Amsterdam',
    start_date: earliestDay,
    end_date: latestDay,
    timetable_announced: true,
    website_url: url,
  }

  console.log(`Festival: ${festival.name} (${festival.start_date} to ${festival.end_date})`)
  console.log(`Stages: ${stages.map(s => s.name).join(', ')}`)
  console.log(`Total: ${sets.length} sets across ${stages.length} stages`)
  console.log(`Artists with bios: ${artists.filter(a => a.bio).length}/${artists.length}`)

  return { festival, stages, sets, artists }
}
