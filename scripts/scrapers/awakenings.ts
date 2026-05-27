import type { ScrapedData, ScrapedSet, ScrapedStage, ScrapedArtist } from './types.js'
import { fetchWithCheerio, parseTimeRange, generateSlug, sleep } from './base.js'
import type { CheerioAPI, Cheerio, Element } from 'cheerio'

const DAY_NAMES: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 0,
}

export function parseFestivalDates(dateText: string): { start_date: string; end_date: string } {
  // "Saturday May 16 2026 - Sunday May 17 2026 Sold out"
  const cleaned = dateText.replace(/\s*(Sold out|Tickets|Available).*$/i, '').trim()
  const parts = cleaned.split(/\s*-\s*/)
  return {
    start_date: parseAwakeningsDate(parts[0].trim()),
    end_date: parseAwakeningsDate(parts[parts.length - 1].trim()),
  }
}

export function parseAwakeningsDate(text: string): string {
  // "Saturday May 16 2026" or "May 16 2026"
  const match = text.match(/(\w+)\s+(\d{1,2})\s+(\d{4})$/)
  if (!match) throw new Error(`Cannot parse date: "${text}"`)
  const [, monthStr, day, year] = match
  const months: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04',
    May: '05', June: '06', July: '07', August: '08',
    September: '09', October: '10', November: '11', December: '12',
  }
  const month = months[monthStr]
  if (!month) throw new Error(`Unknown month: "${monthStr}"`)
  return `${year}-${month}-${day.padStart(2, '0')}`
}

export function resolveDayDate(
  dayName: string,
  startDate: string,
  endDate: string,
): string {
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const targetDay = DAY_NAMES[dayName.toUpperCase()]
  if (targetDay === undefined) throw new Error(`Unknown day: "${dayName}"`)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === targetDay) {
      return d.toISOString().split('T')[0]
    }
  }
  throw new Error(`Day "${dayName}" not in range ${startDate}..${endDate}`)
}

function extractArtistName($container: Cheerio<Element>, $: CheerioAPI): { artistName: string; isLive: boolean } {
  const fullText = $container.text().replace(/\s+/g, ' ').trim()
  const isLive = /\(live\)/i.test(fullText)
  const artistName = fullText.replace(/\s*\(live\)\s*/gi, '').trim()
  return { artistName, isLive }
}

function extractArtistLinks(
  $container: Cheerio<Element>,
  $: CheerioAPI,
): Array<{ name: string; url: string }> {
  const links: Array<{ name: string; url: string }> = []
  $container.find('a.layoutItem__lineup--multiple-items-artists-link').each((_, el) => {
    const $a = $(el)
    const name = $a.text().trim()
    const href = $a.attr('href')
    if (name && href) {
      links.push({ name, url: href.startsWith('http') ? href : `https://www.awakenings.com${href}` })
    }
  })
  return links
}

async function fetchArtistBio(url: string): Promise<string | null> {
  try {
    const $ = await fetchWithCheerio(url)
    const bioSelectors = [
      '.artist__bio', '.artist__description', '.layoutItem__text',
      '[class*="artist"] p', '.content__text',
    ]
    for (const selector of bioSelectors) {
      const text = $(selector).first().text().trim()
      if (text && text.length > 20) return text
    }
    const paragraphs = $('p').filter((_, el) => {
      const t = $(el).text().trim()
      return t.length > 50 && !t.includes('cookie') && !t.includes('privacy')
    })
    const bio = paragraphs.first().text().trim()
    return bio.length > 20 ? bio : null
  } catch {
    return null
  }
}

export async function scrapeAwakenings(url: string): Promise<ScrapedData> {
  console.log(`Fetching ${url}...`)
  const $ = await fetchWithCheerio(url)

  // Festival metadata
  const rawTitle = $('.layoutItem__title').first().text().replace(/\s+/g, ' ').trim()
  const subtitle = $('.layoutItem__subtitle').first().text().trim()
  // Subtitle is either the brand ("Awakenings") or the year ("2026").
  // Brand: remove from title, prepend → "Awakenings Upclose 2026"
  // Year: rawTitle already has everything in correct order → "Awakenings Festival 2026"
  let festivalName: string
  if (!subtitle || /^\d{4}$/.test(subtitle)) {
    festivalName = rawTitle
  } else {
    const titleWithoutBrand = rawTitle.replace(new RegExp(`\\s*${subtitle}\\s*`, 'i'), '').trim()
    festivalName = `${subtitle} ${titleWithoutBrand}`
  }

  const dateText = $('.layoutItem__date').first().text().replace(/\s+/g, ' ').trim()
  const { start_date, end_date } = parseFestivalDates(dateText)

  const timeText = $('.layoutItem__time').first().text().replace(/\s+/g, ' ').trim()
  const locationMatch = timeText.match(/at\s+(.+)$/i)
  const location = locationMatch ? locationMatch[1].trim() : null

  const slug = generateSlug(festivalName)

  const festival = {
    name: festivalName,
    slug,
    location,
    start_date,
    end_date,
    timetable_announced: true,
    website_url: url,
  }

  console.log(`Festival: ${festivalName} (${start_date} to ${end_date})`)
  console.log(`Location: ${location}`)

  // Parse timetable — one block per day
  const stages: ScrapedStage[] = []
  const sets: ScrapedSet[] = []
  const artistLinks = new Map<string, string>()
  const stageNames = new Set<string>()

  const timetableBlocks = $('.layoutItem__lineup--multiple')
  timetableBlocks.each((blockIdx, block) => {
    const dayLabel = $(block).prev('.blockTitle').text().trim()
    const dayDate = resolveDayDate(dayLabel, start_date, end_date)
    console.log(`\n  ${dayLabel} (${dayDate})`)

    const stageItems = $(block).find('.layoutItem__lineup--multiple-stage-item')
    stageItems.each((stageIdx, stageEl) => {
      const stageName = $(stageEl).find('.layoutItem__lineup--multiple-stage-title').first().text().trim()
      if (!stageNames.has(stageName)) {
        stageNames.add(stageName)
        stages.push({ name: stageName, sort_order: stages.length + 1 })
      }

      const setEntries = $(stageEl).find('.layoutItem__lineup--multiple-items-artists')
      console.log(`    ${stageName}: ${setEntries.length} sets`)

      setEntries.each((_, setEl) => {
        const timeText = $(setEl).find('.layoutItem__lineup--multiple-items-dates').text()
        const times = parseTimeRange(timeText)
        const $container = $(setEl).find('.layoutItem__lineup--multiple-artists-container').first()
        const { artistName, isLive } = extractArtistName($container, $)

        if (!artistName) return

        sets.push({
          artist_name: artistName,
          stage: stageName,
          day: dayDate,
          start_time: times?.start_time ?? null,
          end_time: times?.end_time ?? null,
          is_live: isLive,
        })

        for (const link of extractArtistLinks($container, $)) {
          if (!artistLinks.has(link.name.toLowerCase())) {
            artistLinks.set(link.name.toLowerCase(), link.url)
          }
        }
      })
    })
  })

  // Sort after-party stages last (they may appear before regular stages that only exist on later days)
  const isAfterParty = (name: string) => /after|camping/i.test(name)
  stages.sort((a, b) => {
    const aAfter = isAfterParty(a.name) ? 1 : 0
    const bAfter = isAfterParty(b.name) ? 1 : 0
    if (aAfter !== bAfter) return aAfter - bAfter
    return a.sort_order - b.sort_order
  })
  stages.forEach((s, i) => { s.sort_order = i + 1 })

  // Handle lineup-only if no timetable blocks found
  if (timetableBlocks.length === 0) {
    festival.timetable_announced = false
    console.log('  No timetable found — attempting lineup-only extraction')
    // TODO: Extract lineup-only data from alternative page structure
  }

  console.log(`\n  Total: ${sets.length} sets across ${stages.length} stages`)
  console.log(`  Unique artist links: ${artistLinks.size}`)

  // Fetch artist bios (rate-limited)
  const artists: ScrapedArtist[] = []
  const skipBios = process.argv.includes('--skip-bios')

  if (!skipBios && artistLinks.size > 0) {
    console.log(`\n  Fetching artist bios (${artistLinks.size} pages)...`)
    let fetched = 0
    for (const [name, pageUrl] of artistLinks) {
      fetched++
      process.stdout.write(`    [${fetched}/${artistLinks.size}] ${name}... `)
      const bio = await fetchArtistBio(pageUrl)
      artists.push({
        name: [...artistLinks.entries()].find(([k]) => k === name)?.[0] || name,
        bio,
        source_url: pageUrl,
      })
      console.log(bio ? `${bio.length} chars` : 'no bio')
      if (fetched < artistLinks.size) await sleep(500)
    }
  } else if (skipBios) {
    console.log('\n  Skipping artist bios (--skip-bios)')
    for (const [name, pageUrl] of artistLinks) {
      artists.push({ name, bio: null, source_url: pageUrl })
    }
  }

  return { festival, stages, sets, artists }
}
