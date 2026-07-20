import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ScrapedData, ScrapedSet, ScrapedStage, ScrapedArtist } from './types.js'
import { fetchNuxtData, getBrowser, generateSlug } from './base.js'
import { extractPosterDayVision } from '../lib/extract/poster-vision.js'

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

// "AT DAWN:" is a programming-block label, not part of the artist name. Strip it and
// turn it into a stage modifier so at-dawn sets live on their own stage variant
// (e.g. "AT DAWN: JAMES HOLDEN" on "GREENHOUSE" → "JAMES HOLDEN" on "GREENHOUSE: AT DAWN").
export function splitAtDawn(artistName: string, stage: string | null): { artistName: string; stage: string | null } {
  const m = artistName.match(/^at dawn:\s*(.+)$/i)
  if (!m) return { artistName, stage }
  return { artistName: m[1].trim(), stage: stage ? `${stage}: AT DAWN` : stage }
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

// ── Poster hybrid mode ────────────────────────────────────────────────────────
// Dekmantel's Nuxt payload is authoritative for names/bios/socials but NOT for
// times: the designed poster PNGs are the real schedule, and the CMS timeslots
// are half-maintained (00:00–23:00 placeholders survive for months). Hybrid:
// poster = time/stage authority (pixel-measured), Nuxt = spelling/bio authority.

export type DayImage = { day: string; src: string }

/** Click through the timetable day tabs and collect each day's full-res image URL. */
export async function discoverTimetableImages(url: string, startDate: string, endDate: string): Promise<DayImage[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    const tabs = page.locator('button, a, [role="tab"]')
      .filter({ hasText: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*\d{1,2}/i })
    const count = await tabs.count()
    const images: DayImage[] = []
    const seen = new Set<string>()

    for (let i = 0; i < count; i++) {
      const label = (await tabs.nth(i).innerText()).trim()
      const dayOfMonth = parseInt(label.match(/(\d{1,2})/)?.[1] ?? '', 10)
      if (isNaN(dayOfMonth)) continue

      await tabs.nth(i).click()
      await page.waitForTimeout(1500)
      const src = await page.locator('.timetable__image-wrapper img, .timetable img').first()
        .evaluate((img: HTMLImageElement) => img.currentSrc || img.src)
        .catch(() => null)
      if (!src || seen.has(src)) continue
      seen.add(src)

      const day = resolveDayDate(dayOfMonth, startDate, endDate)
      if (day) images.push({ day, src })
    }
    return images
  } finally {
    await page.close()
  }
}

/** Map a day-of-month from a tab label to a full date within the festival range. */
export function resolveDayDate(dayOfMonth: number, startDate: string, endDate: string): string | null {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDate() === dayOfMonth) return d.toISOString().split('T')[0]
  }
  return null
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

export type CanonicalName = { name: string; isLive: boolean }

/** Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const d = new Array(n + 1)
  for (let j = 0; j <= n; j++) d[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[n]
}

/**
 * Resolve a poster-read artist name to its authoritative Nuxt spelling: exact
 * normalized match first, then a conservative fuzzy fallback for OCR slips in
 * stylized fonts (e.g. "MESKA"→"Neska", "KOMDUKU"→"Konduku"). The fuzzy match
 * only fires on a single unambiguous nearest name within a tight edit-distance
 * budget (≤2 chars, ≤15% of length); ties or larger gaps keep the poster text
 * and surface in the diff review.
 */
export function matchCanonical(name: string, canonical: Map<string, CanonicalName>): CanonicalName | undefined {
  const norm = normalizeName(name)
  const exact = canonical.get(norm)
  if (exact) return exact

  let best: CanonicalName | undefined, bestKey = '', bestD = Infinity, tie = false
  for (const [key, val] of canonical) {
    const d = levenshtein(norm, key)
    if (d < bestD) { bestD = d; best = val; bestKey = key; tie = false }
    else if (d === bestD) tie = true
  }
  if (!best || tie) return undefined
  const budget = Math.min(2, Math.max(1, Math.floor(Math.max(norm.length, bestKey.length) * 0.15)))
  return bestD <= budget ? best : undefined
}

export async function scrapeDekmantelHybrid(url: string): Promise<ScrapedData> {
  // Nuxt pass — names, bios, festival dates (existing extraction, unchanged)
  const nuxtResult = await scrapeDekmantel(url)

  // canonical-casing + live-status lookup from Nuxt set names (authoritative spelling)
  const canonical = new Map<string, CanonicalName>()
  for (const s of nuxtResult.sets) {
    canonical.set(normalizeName(s.artist_name), { name: s.artist_name, isLive: s.is_live })
  }

  console.log('Discovering timetable poster images...')
  const dayImages = await discoverTimetableImages(url, nuxtResult.festival.start_date, nuxtResult.festival.end_date)
  if (dayImages.length === 0) {
    console.warn('No poster images found — falling back to Nuxt times')
    return nuxtResult
  }
  console.log(`Found ${dayImages.length} day poster(s)`)

  const posterDir = 'scraped/posters'
  mkdirSync(posterDir, { recursive: true })

  const stages: ScrapedStage[] = []
  const stageNames = new Set<string>()
  const sets: ScrapedSet[] = []
  const extractionWarnings: string[] = []

  for (const { day, src } of dayImages) {
    console.log(`  ${day}: downloading poster...`)
    const res = await fetch(src)
    if (!res.ok) { console.warn(`  ! HTTP ${res.status} for ${src}`); continue }
    const imgPath = join(posterDir, `dekmantel-${day}.png`)
    writeFileSync(imgPath, Buffer.from(await res.arrayBuffer()))

    console.log(`  ${day}: extracting (calibrated vision)...`)
    const result = await extractPosterDayVision(imgPath, { day, workDir: join(posterDir, 'vision') })
    if (!result) { console.warn(`  ! geometry failed for ${day}`); continue }
    if (result.failedStrips.length > 0) {
      console.warn(`  ! failed strips on ${day}: ${result.failedStrips.join(', ')}`)
      extractionWarnings.push(`${day} ${result.failedStrips.join(', ')}: times from vision fallback (pixel gridlines not fully detected) — verify against the poster`)
    }

    for (const s of result.sets) {
      const { artistName: dawnName, stage: dawnStage } = splitAtDawn(s.artist_name, s.stage)
      const match = matchCanonical(dawnName, canonical)
      if (match && normalizeName(match.name) !== normalizeName(dawnName)) {
        console.log(`    ~ name: "${dawnName}" → "${match.name}" (matched Nuxt spelling)`)
      }
      if (dawnStage && !stageNames.has(dawnStage)) {
        stageNames.add(dawnStage)
        stages.push({ name: dawnStage, sort_order: stages.length + 1 })
      }
      sets.push({
        ...s,
        stage: dawnStage,
        artist_name: match?.name ?? dawnName, // Nuxt casing/spelling wins when the artist matches
        is_live: s.is_live || (match?.isLive ?? false),
      })
    }
    console.log(`  ${day}: ${result.sets.length} sets`)
  }

  if (sets.length === 0) {
    console.warn('Poster extraction produced no sets — falling back to Nuxt times')
    return nuxtResult
  }

  return {
    festival: nuxtResult.festival,
    stages,
    sets,
    artists: nuxtResult.artists, // bios/source_urls straight from Nuxt
    ...(extractionWarnings.length > 0 && { extraction_warnings: extractionWarnings }),
  }
}
