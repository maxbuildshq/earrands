import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ScrapedData, ScrapedFestival, ScrapedStage, ScrapedSet, ScrapedArtist } from '../../scrapers/types.js'
import type { PageDump } from './page-dump.js'
import { findRecordArrays, chunkItems } from './chunk.js'
import { callClaude, extractJsonBlock } from './claude-cli.js'

export { extractJsonBlock } // re-exported — external callers/tests import it from here

const SCHEMA_DESCRIPTION = `{
  "festival": {
    "name": string,                  // festival name, no year suffix unless part of the brand
    "slug": string,                  // lowercase-kebab-case, include year if the event is annual, e.g. "awakenings-festival-2026"
    "location": string | null,       // "City, Country" or venue name
    "start_date": string,            // YYYY-MM-DD
    "end_date": string,              // YYYY-MM-DD
    "timetable_announced": boolean,  // true only if sets have stage + start/end times
    "website_url": string            // the page URL
  },
  "stages": [{ "name": string, "sort_order": number }],  // in the order the site presents them; empty if lineup-only
  "sets": [{
    "artist_name": string,           // EXACTLY as written on the page, e.g. "Alarico & Ben Klock", "KI/KI (live)"
    "stage": string | null,          // must match a stages[].name; null if lineup-only
    "day": string,                   // calendar date YYYY-MM-DD the set STARTS on (after-midnight sets belong to the previous festival day's date only if the site groups them that way — use the site's grouping)
    "start_time": string | null,     // HH:MM 24h; null if lineup-only
    "end_time": string | null,
    "is_live": boolean               // true if marked live/(live)/LIVE
  }],
  "artists": [{
    "name": string,                  // individual artist name
    "bio": string | null,            // bio text from the page if present, else null
    "source_url": string | null,     // artist detail page URL if present
    "image_url": string | null       // artist photo URL from the page if present (press/reference photo)
  }]
}`

export function buildExtractionPrompt(dump: PageDump, dumpPath: string, outPath: string): string {
  const parts: string[] = []
  parts.push('You are extracting structured festival lineup/timetable data from a scraped web page.')
  parts.push('')
  parts.push(`The full page dump is a JSON file at: ${dumpPath}`)
  parts.push('It has these keys: url, title, text (visible DOM text), payloads (embedded framework state: __NUXT__/__NEXT_DATA__/ldJson), xhr (captured JSON API responses), images ({src, alt}[]).')
  parts.push('It can be large — read it in chunks or grep for the sections you need rather than loading it whole.')
  parts.push('')
  parts.push(`Extract the data and WRITE it as a single JSON object to: ${outPath}`)
  parts.push('The extraction can be large — write the file; do NOT print the JSON in your reply. When done, reply with exactly: DONE')
  parts.push('')
  parts.push('The JSON must match this schema:')
  parts.push(SCHEMA_DESCRIPTION)
  parts.push('')
  parts.push('Rules:')
  parts.push('- Do not invent data. If a field is not on the page, use null (or [] for lists).')
  parts.push('- Every set must appear exactly once. Never duplicate (artist_name, day, stage) combinations.')
  parts.push('- Keep artist_name verbatim from the page — do not split B2B/collab names; downstream parsing handles that.')
  parts.push('- artists[] lists individual artists only when the page has per-artist content (bio, detail page, photo). Otherwise leave it empty.')
  parts.push('- Prefer embedded JSON payloads and XHR responses over visible text when both are present — they are more precise.')
  parts.push('- Match artist image URLs from the images list by alt text or URL slug; when unsure, use null.')
  parts.push('')
  parts.push(`Page URL: ${dump.url}`)
  parts.push(`Page title: ${dump.title}`)
  parts.push(`Dump stats: ${dump.text.length} chars text, payloads [${Object.keys(dump.payloads).join(', ') || 'none'}], ${dump.xhr.length} XHR responses, ${dump.images.length} images.`)

  return parts.join('\n')
}

export type ValidationResult =
  | { ok: true; data: ScrapedData; warnings: string[] }
  | { ok: false; errors: string[] }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function validateScrapedData(input: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const data = input as ScrapedData

  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: ['not a JSON object'] }
  }

  const f = data.festival
  if (!f || typeof f !== 'object') {
    errors.push('missing festival object')
  } else {
    if (!f.name) errors.push('festival.name missing')
    if (!f.slug || !SLUG_RE.test(f.slug)) errors.push(`festival.slug invalid: "${f.slug}"`)
    if (!DATE_RE.test(f.start_date ?? '')) errors.push(`festival.start_date invalid: "${f.start_date}"`)
    if (!DATE_RE.test(f.end_date ?? '')) errors.push(`festival.end_date invalid: "${f.end_date}"`)
    if (typeof f.timetable_announced !== 'boolean') errors.push('festival.timetable_announced must be boolean')
  }

  if (!Array.isArray(data.stages)) {
    errors.push('stages must be an array')
  }
  if (!Array.isArray(data.artists)) {
    errors.push('artists must be an array')
  }

  if (!Array.isArray(data.sets)) {
    errors.push('sets must be an array')
  } else {
    if (data.sets.length === 0) warnings.push('no sets extracted')
    const stageNames = new Set((data.stages ?? []).map(s => s.name))
    const seen = new Set<string>()
    data.sets.forEach((s, i) => {
      if (!s.artist_name) errors.push(`sets[${i}].artist_name missing`)
      if (!DATE_RE.test(s.day ?? '')) errors.push(`sets[${i}].day invalid: "${s.day}" (${s.artist_name})`)
      if (s.start_time != null && !TIME_RE.test(s.start_time)) errors.push(`sets[${i}].start_time invalid: "${s.start_time}" (${s.artist_name})`)
      if (s.end_time != null && !TIME_RE.test(s.end_time)) errors.push(`sets[${i}].end_time invalid: "${s.end_time}" (${s.artist_name})`)
      if (s.stage != null && !stageNames.has(s.stage)) errors.push(`sets[${i}].stage "${s.stage}" not in stages[] (${s.artist_name})`)
      const key = `${s.artist_name}|${s.day}|${s.stage}`
      if (seen.has(key)) errors.push(`duplicate set: ${s.artist_name} on ${s.day} at ${s.stage ?? 'no stage'}`)
      seen.add(key)
    })
    const timed = data.sets.filter(s => s.start_time != null).length
    if (timed > 0 && timed < data.sets.length) {
      warnings.push(`${data.sets.length - timed} of ${data.sets.length} sets have no start_time`)
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, data, warnings }
}

const FESTIVAL_META_SCHEMA = `{
  "name": string,                  // festival name, no year suffix unless part of the brand
  "slug": string,                  // lowercase-kebab-case, include year if the event is annual, e.g. "awakenings-festival-2026"
  "location": string | null,       // "City, Country" or venue name
  "start_date": string,            // YYYY-MM-DD — earliest festival day
  "end_date": string,              // YYYY-MM-DD — latest festival day
  "timetable_announced": boolean,  // true only if individual sets have confirmed stage + start/end times
  "website_url": string
}`

function extractFestivalMeta(dump: PageDump): ScrapedFestival | null {
  const prompt = [
    'Extract only the festival-level metadata from this page. Output ONLY a JSON object matching this schema — no markdown fences, no commentary:',
    FESTIVAL_META_SCHEMA,
    '',
    `Page URL: ${dump.url}`,
    `Page title: ${dump.title}`,
    '--- PAGE TEXT ---',
    dump.text.slice(0, 20_000),
  ].join('\n')

  try {
    const raw = callClaude(prompt, { timeout: 120_000 })
    return JSON.parse(extractJsonBlock(raw))
  } catch {
    return null
  }
}

const CHUNK_SCHEMA = `{
  "sets": [{
    "artist_name": string,           // EXACTLY as written, e.g. "Alarico & Ben Klock", "KI/KI (live)"
    "stage": string | null,          // stage/location/venue name; null if lineup-only
    "day": string,                   // calendar date YYYY-MM-DD the set STARTS on
    "start_time": string | null,     // HH:MM 24h; null if lineup-only
    "end_time": string | null,
    "is_live": boolean               // true if marked live/(live)/LIVE
  }],
  "artists": [{
    "name": string,                  // individual artist name
    "bio": string | null,
    "source_url": string | null,
    "image_url": string | null       // artist photo URL if present
  }]
}`

function extractChunk(items: unknown[], festival: ScrapedFestival): { sets: ScrapedSet[]; artists: ScrapedArtist[] } | null {
  const prompt = [
    'Extract festival sets and artists from this batch of records (part of a larger lineup/timetable).',
    'Output ONLY a JSON object matching this schema — no markdown fences, no commentary:',
    CHUNK_SCHEMA,
    '',
    'Rules:',
    '- Do not invent data. If a field is not present, use null.',
    '- One record may produce one set, multiple sets (recurring/multi-day), or zero (non-performing entries).',
    '- Keep artist_name verbatim — do not split B2B/collab names.',
    '- artists[] only for records with per-artist content (bio, detail page, photo).',
    `- Festival context: "${festival.name}", ${festival.start_date} to ${festival.end_date}.`,
    '',
    '--- RECORDS ---',
    JSON.stringify(items),
  ].join('\n')

  const attempts = [0, 15_000, 60_000] // immediate, then back off — covers transient rate/usage-window limits
  let lastErr = ''
  for (const delayMs of attempts) {
    if (delayMs > 0) {
      console.log(`  ! retrying in ${delayMs / 1000}s...`)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
    }
    try {
      const raw = callClaude(prompt, { timeout: 300_000 })
      const parsed = JSON.parse(extractJsonBlock(raw))
      return {
        sets: Array.isArray(parsed.sets) ? parsed.sets : [],
        artists: Array.isArray(parsed.artists) ? parsed.artists : [],
      }
    } catch (err: any) {
      lastErr = err.stderr?.toString().trim() || err.message || String(err)
    }
  }
  console.error(`  ! chunk extraction failed after retries: ${lastErr}`)
  return null
}

function mergeStages(sets: ScrapedSet[]): ScrapedStage[] {
  const names: string[] = []
  for (const s of sets) {
    if (s.stage && !names.includes(s.stage)) names.push(s.stage)
  }
  return names.map((name, i) => ({ name, sort_order: i }))
}

const CHUNK_CHAR_BUDGET = 80_000
const SINGLE_SHOT_THRESHOLD = 100_000 // below this, whole-dump agentic extraction is simpler and fine

/** Chunked extraction: find the largest array of similarly-shaped records in the
 *  payload (the lineup/timetable, regardless of framework) and extract it in
 *  batches, avoiding the context ceiling a ~200k+ token single-shot call hits. */
function extractChunked(dump: PageDump, candidate: { items: unknown[] }): ValidationResult {
  console.log(`  Extracting festival metadata...`)
  const festival = extractFestivalMeta(dump)
  if (!festival) return { ok: false, errors: ['failed to extract festival metadata'] }

  const chunks = chunkItems(candidate.items, CHUNK_CHAR_BUDGET)
  console.log(`  Extracting ${candidate.items.length} records in ${chunks.length} chunk(s)...`)

  const allSets: ScrapedSet[] = []
  const allArtists: ScrapedArtist[] = []
  let failedChunks = 0

  chunks.forEach((chunk, i) => {
    console.log(`  Chunk ${i + 1}/${chunks.length} (${chunk.length} records)...`)
    const result = extractChunk(chunk, festival)
    if (!result) { failedChunks++; return }
    allSets.push(...result.sets)
    allArtists.push(...result.artists)
  })

  if (allSets.length === 0) {
    return { ok: false, errors: ['no sets extracted from any chunk', ...(failedChunks > 0 ? [`${failedChunks}/${chunks.length} chunks failed`] : [])] }
  }

  const data: ScrapedData = {
    festival,
    stages: mergeStages(allSets),
    sets: allSets,
    artists: allArtists,
  }

  const result = validateScrapedData(data)
  if (failedChunks > 0 && result.ok) {
    result.warnings.push(`${failedChunks}/${chunks.length} chunks failed extraction — data may be incomplete`)
  }
  return result
}

function extractSingleShot(dump: PageDump, dumpPath: string): ValidationResult {
  const outPath = resolve(dumpPath.replace(/\.json$/, '') + '.extracted.json')
  rmSync(outPath, { force: true }) // never validate a stale extraction
  const prompt = buildExtractionPrompt(dump, resolve(dumpPath), outPath)

  try {
    callClaude(prompt, { tools: 'Read,Grep,Write', timeout: 600_000 })
  } catch (err: any) {
    const msg = err.stderr?.toString().trim() || err.message || String(err)
    return { ok: false, errors: [`claude CLI failed: ${msg}`] }
  }

  if (!existsSync(outPath)) {
    return { ok: false, errors: [`claude finished but did not write ${outPath}`] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(readFileSync(outPath, 'utf-8')))
  } catch {
    return { ok: false, errors: [`extraction file is not valid JSON: ${outPath}`] }
  }

  return validateScrapedData(parsed)
}

export function extractWithLLM(dump: PageDump, dumpPath: string): ValidationResult {
  const searchRoot = { ...dump.payloads, __xhr: dump.xhr.map(x => x.body) }
  const candidates = findRecordArrays(searchRoot)
  const best = candidates[0]

  if (best && best.size > SINGLE_SHOT_THRESHOLD) {
    console.log(`  Found record array at "${best.path}" (${best.items.length} items, ${best.size} chars) — using chunked extraction`)
    return extractChunked(dump, best)
  }

  return extractSingleShot(dump, dumpPath)
}
