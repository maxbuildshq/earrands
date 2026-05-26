#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { findAdapter } from './scrapers/index.js'
import { closeBrowser } from './scrapers/base.js'
import { parseArtistName } from './lib/artist-parser.js'
import type { ScrapedData, ScrapedSet } from './scrapers/types.js'

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const urlArg = args.find(a => a.startsWith('--url='))?.split('=').slice(1).join('=')
const jsonArg = args.find(a => a.startsWith('--json='))?.split('=').slice(1).join('=')
const dryRun = args.includes('--dry-run')
const skipBios = args.includes('--skip-bios')

if (!urlArg && !jsonArg) {
  console.log(`Usage:
  npm run ingest -- --url=<festival-url>        Scrape and ingest
  npm run ingest -- --json=<path.json>          Ingest from JSON file
  npm run ingest -- --url=<url> --dry-run       Preview diff only
  npm run ingest -- --url=<url> --skip-bios     Skip fetching artist bios`)
  process.exit(0)
}

console.log('Festival Pulse — Ingest Pipeline')
console.log('────────────────────────────────')
if (dryRun) console.log(chalk.yellow('DRY RUN — no SQL file will be generated'))
console.log()

// ── Supabase ─────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error(chalk.red('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'))
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Step 1: Get scraped data ─────────────────────────────────────────────────

async function getScrapedData(): Promise<ScrapedData> {
  if (jsonArg) {
    if (!existsSync(jsonArg)) {
      console.error(chalk.red(`File not found: ${jsonArg}`))
      process.exit(1)
    }
    console.log(`Loading from ${jsonArg}...`)
    return JSON.parse(readFileSync(jsonArg, 'utf-8'))
  }

  const adapter = findAdapter(urlArg!)
  if (!adapter) {
    console.error(chalk.red(`No scraper adapter for URL: ${urlArg}`))
    console.error('Available adapters:')
    console.error('  - awakenings.com')
    console.error('\nFor unsupported sites, extract data as JSON and use --json=<path>')
    process.exit(1)
  }

  console.log(`Using ${adapter.name} adapter`)
  return adapter.adapter(urlArg!)
}

// ── Step 2: Fetch current DB state ───────────────────────────────────────────

type DbState = {
  festival: { id: string; name: string; slug: string; location: string | null; start_date: string; end_date: string; timetable_announced: boolean } | null
  stages: Array<{ id: string; festival_id: string; name: string; sort_order: number }>
  sets: Array<{ id: string; festival_id: string; stage_id: string | null; artist_name: string; day: string; start_time: string | null; end_time: string | null; is_live: boolean }>
  artists: Array<{ id: string; name: string; sort_name: string; bio: string | null; source_url: string | null }>
}

async function fetchCurrentState(slug: string): Promise<DbState> {
  const { data: festival } = await supabase
    .from('festivals')
    .select('id, name, slug, location, start_date, end_date, timetable_announced')
    .eq('slug', slug)
    .single()

  if (!festival) {
    return { festival: null, stages: [], sets: [], artists: [] }
  }

  const { data: stages } = await supabase
    .from('stages')
    .select('id, festival_id, name, sort_order')
    .eq('festival_id', festival.id)

  const { data: sets } = await supabase
    .from('sets')
    .select('id, festival_id, stage_id, artist_name, day, start_time, end_time, is_live')
    .eq('festival_id', festival.id)

  const { data: artists } = await supabase
    .from('artists')
    .select('id, name, sort_name, bio, source_url')

  return {
    festival,
    stages: stages ?? [],
    sets: sets ?? [],
    artists: artists ?? [],
  }
}

// ── Step 3: Compute diff ─────────────────────────────────────────────────────

type DiffEntry = {
  type: 'added' | 'removed' | 'changed' | 'rescheduled'
  category: string
  label: string
  details?: string
}

type ExistingSetInfo = {
  artist_name: string
  day: string
  stage_name: string | null
  start_time: string | null
  end_time: string | null
  is_live: boolean
}

type SetDiff = {
  added: ScrapedSet[]
  removed: ExistingSetInfo[]
  updated: Array<{ scraped: ScrapedSet; existing: ExistingSetInfo; changes: string[] }>
  rescheduled: Array<{ scraped: ScrapedSet; existing: ExistingSetInfo }>
  unchanged: ScrapedSet[]
}

function normalizeTime(t: string | null): string | null {
  if (!t) return null
  return t.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1')
}

function normalizeText(t: string): string {
  return t.normalize('NFC').replace(/[''′]/g, "'").replace(/[""]/g, '"')
}

function setKey(artistName: string, day: string, stage: string | null): string {
  return `${normalizeText(artistName)}|${day}|${stage ?? ''}`
}

type DiffResult = {
  entries: DiffEntry[]
  setDiff: SetDiff
}

function computeDiff(scraped: ScrapedData, current: DbState): DiffResult {
  const entries: DiffEntry[] = []
  const setDiff: SetDiff = { added: [], removed: [], updated: [], rescheduled: [], unchanged: [] }

  // Festival
  if (!current.festival) {
    entries.push({ type: 'added', category: 'festival', label: scraped.festival.name })
  } else {
    const f = current.festival
    const s = scraped.festival
    const changes: string[] = []
    if (f.name !== s.name) changes.push(`name: "${f.name}" → "${s.name}"`)
    if (f.location !== s.location) changes.push(`location: "${f.location}" → "${s.location}"`)
    if (f.start_date !== s.start_date) changes.push(`start_date: ${f.start_date} → ${s.start_date}`)
    if (f.end_date !== s.end_date) changes.push(`end_date: ${f.end_date} → ${s.end_date}`)
    if (f.timetable_announced !== s.timetable_announced) changes.push(`timetable: ${f.timetable_announced} → ${s.timetable_announced}`)
    if (changes.length > 0) {
      entries.push({ type: 'changed', category: 'festival', label: s.name, details: changes.join(', ') })
    }
  }

  // Stages
  const currentStageNames = new Set(current.stages.map(s => s.name))
  const scrapedStageNames = new Set(scraped.stages.map(s => s.name))

  for (const stage of scraped.stages) {
    if (!currentStageNames.has(stage.name)) {
      entries.push({ type: 'added', category: 'stage', label: stage.name })
    }
  }
  for (const stage of current.stages) {
    if (!scrapedStageNames.has(stage.name)) {
      entries.push({ type: 'removed', category: 'stage', label: stage.name })
    }
  }

  // Sets — two-pass matching by (artist_name, day, stage)
  const stageIdToName = new Map(current.stages.map(s => [s.id, s.name]))

  function resolveExisting(s: DbState['sets'][0]): ExistingSetInfo {
    return {
      artist_name: s.artist_name,
      day: s.day,
      stage_name: stageIdToName.get(s.stage_id ?? '') ?? null,
      start_time: s.start_time,
      end_time: s.end_time,
      is_live: s.is_live,
    }
  }

  const currentSetKeys = new Map<string, ExistingSetInfo>()
  for (const s of current.sets) {
    const info = resolveExisting(s)
    currentSetKeys.set(setKey(s.artist_name, s.day, info.stage_name), info)
  }

  // Pass 1: exact match by (artist_name, day, stage)
  const matchedScrapedIdx = new Set<number>()
  const matchedExistingKeys = new Set<string>()

  for (let i = 0; i < scraped.sets.length; i++) {
    const set = scraped.sets[i]
    const key = setKey(set.artist_name, set.day, set.stage)
    const existing = currentSetKeys.get(key)
    if (!existing) continue

    matchedScrapedIdx.add(i)
    matchedExistingKeys.add(key)

    const changes: string[] = []
    if (normalizeTime(set.start_time) !== normalizeTime(existing.start_time))
      changes.push(`start: ${existing.start_time ?? 'null'} → ${set.start_time ?? 'null'}`)
    if (normalizeTime(set.end_time) !== normalizeTime(existing.end_time))
      changes.push(`end: ${existing.end_time ?? 'null'} → ${set.end_time ?? 'null'}`)
    if (set.is_live !== existing.is_live)
      changes.push(`live: ${existing.is_live} → ${set.is_live}`)

    if (changes.length > 0) {
      setDiff.updated.push({ scraped: set, existing, changes })
      entries.push({ type: 'changed', category: 'set', label: `${set.artist_name} (${set.day})`, details: changes.join(', ') })
    } else {
      setDiff.unchanged.push(set)
    }
  }

  // Collect unmatched
  const unmatchedScraped = scraped.sets.filter((_, i) => !matchedScrapedIdx.has(i))
  const unmatchedExisting: ExistingSetInfo[] = []
  for (const [key, info] of currentSetKeys) {
    if (!matchedExistingKeys.has(key)) unmatchedExisting.push(info)
  }

  // Pass 2: reschedule detection — match by artist_name alone
  const unmatchedScrapedByArtist = new Map<string, ScrapedSet[]>()
  for (const set of unmatchedScraped) {
    const k = normalizeText(set.artist_name).toLowerCase()
    const list = unmatchedScrapedByArtist.get(k) ?? []
    list.push(set)
    unmatchedScrapedByArtist.set(k, list)
  }

  const unmatchedExistingByArtist = new Map<string, ExistingSetInfo[]>()
  for (const set of unmatchedExisting) {
    const k = normalizeText(set.artist_name).toLowerCase()
    const list = unmatchedExistingByArtist.get(k) ?? []
    list.push(set)
    unmatchedExistingByArtist.set(k, list)
  }

  const rescheduledScraped = new Set<ScrapedSet>()
  const rescheduledExisting = new Set<ExistingSetInfo>()

  for (const [artistKey, scrapedSets] of unmatchedScrapedByArtist) {
    const existingSets = unmatchedExistingByArtist.get(artistKey)
    if (!existingSets) continue
    // Only auto-pair when unambiguous (1:1 match)
    if (scrapedSets.length === 1 && existingSets.length === 1) {
      const s = scrapedSets[0]
      const e = existingSets[0]
      setDiff.rescheduled.push({ scraped: s, existing: e })
      rescheduledScraped.add(s)
      rescheduledExisting.add(e)

      const parts: string[] = []
      if (e.day !== s.day) parts.push(`${e.day} → ${s.day}`)
      if (e.stage_name !== s.stage) parts.push(`${e.stage_name ?? 'no stage'} → ${s.stage ?? 'no stage'}`)
      if (normalizeTime(e.start_time) !== normalizeTime(s.start_time))
        parts.push(`${e.start_time ?? 'null'} → ${s.start_time ?? 'null'}`)
      entries.push({
        type: 'rescheduled',
        category: 'set',
        label: s.artist_name,
        details: parts.join(', '),
      })
    }
  }

  // Remaining unmatched → added / removed
  for (const set of unmatchedScraped) {
    if (rescheduledScraped.has(set)) continue
    setDiff.added.push(set)
    entries.push({
      type: 'added',
      category: 'set',
      label: `${set.artist_name} (${set.day})`,
      details: set.stage ? `${set.stage} ${set.start_time ?? '?'}-${set.end_time ?? '?'}` : undefined,
    })
  }
  for (const set of unmatchedExisting) {
    if (rescheduledExisting.has(set)) continue
    setDiff.removed.push(set)
    entries.push({
      type: 'removed',
      category: 'set',
      label: `${set.artist_name} (${set.day})`,
    })
  }

  // Artists — bio updates
  const currentArtistBios = new Map(current.artists.map(a => [a.sort_name, a]))
  for (const artist of scraped.artists) {
    if (!artist.bio) continue
    const existing = currentArtistBios.get(artist.name.toLowerCase())
    if (!existing) {
      entries.push({ type: 'added', category: 'artist bio', label: artist.name, details: `${artist.bio.length} chars` })
    } else if (!existing.bio || artist.bio.length > existing.bio.length) {
      entries.push({ type: 'changed', category: 'artist bio', label: artist.name, details: `${existing.bio?.length ?? 0} → ${artist.bio.length} chars` })
    }
  }

  return { entries, setDiff }
}

// ── Warnings & Flags ────────────────────────────────────────────────────────

type Flag = {
  level: 'reschedule' | 'removal' | 'warn' | 'info'
  message: string
}

function computeFlags(scraped: ScrapedData, setDiff: SetDiff): Flag[] {
  const flags: Flag[] = []

  // Reschedules (most impactful — set IDs reused, user_plans move with them)
  for (const r of setDiff.rescheduled) {
    const parts: string[] = []
    if (r.existing.day !== r.scraped.day) parts.push(`${r.existing.day} → ${r.scraped.day}`)
    if (r.existing.stage_name !== r.scraped.stage) parts.push(`${r.existing.stage_name ?? 'no stage'} → ${r.scraped.stage ?? 'no stage'}`)
    if (normalizeTime(r.existing.start_time) !== normalizeTime(r.scraped.start_time))
      parts.push(`${r.existing.start_time ?? 'no time'} → ${r.scraped.start_time ?? 'no time'}`)
    flags.push({
      level: 'reschedule',
      message: `${r.scraped.artist_name} moved ${parts.join(', ')}`,
    })
  }

  // Removed sets (user data will be lost via cascade)
  for (const r of setDiff.removed) {
    const loc = [r.stage_name, r.day, r.start_time].filter(Boolean).join(' ')
    flags.push({
      level: 'removal',
      message: `${r.artist_name} (${loc}) — will delete user_plans`,
    })
  }

  // Multi-artist sets where individual artists lack source URLs
  const artistUrlMap = new Map(scraped.artists.map(a => [a.name.toLowerCase(), a.source_url]))
  for (const set of scraped.sets) {
    const parsed = parseArtistName(set.artist_name)
    if (parsed.members.length <= 1 && !parsed.collective) continue

    const missing = parsed.members.filter(m => !artistUrlMap.has(m.toLowerCase()))
    if (missing.length > 0) {
      flags.push({
        level: 'warn',
        message: `"${set.artist_name}" — combined link on source site, parsed artists ${missing.map(m => `"${m}"`).join(', ')} have no individual source URL`,
      })
    }
  }

  // Artists scraped with no bio
  const noBio = scraped.artists.filter(a => !a.bio)
  if (noBio.length > 0 && scraped.artists.length > 0) {
    const withBio = scraped.artists.filter(a => a.bio).length
    flags.push({
      level: 'info',
      message: `${withBio}/${scraped.artists.length} artists have bios; ${noBio.length} artist pages had no bio text`,
    })
  }

  // Sets with no times in a timetable-announced festival
  if (scraped.festival.timetable_announced) {
    const noTimes = scraped.sets.filter(s => !s.start_time)
    if (noTimes.length > 0) {
      flags.push({
        level: 'warn',
        message: `Festival marked as timetable_announced but ${noTimes.length} sets have no start_time`,
      })
    }
  }

  // Duplicate artist names with different casing
  const nameCounts = new Map<string, string[]>()
  for (const set of scraped.sets) {
    const parsed = parseArtistName(set.artist_name)
    for (const member of parsed.members) {
      const key = member.toLowerCase()
      const existing = nameCounts.get(key) ?? []
      if (!existing.includes(member)) existing.push(member)
      nameCounts.set(key, existing)
    }
  }
  for (const [, names] of nameCounts) {
    if (names.length > 1) {
      flags.push({
        level: 'warn',
        message: `Inconsistent casing: ${names.map(n => `"${n}"`).join(' vs ')} — will be stored as "${names[0]}"`,
      })
    }
  }

  return flags
}

function printDiff(diff: DiffEntry[]): void {
  if (diff.length === 0) {
    console.log(chalk.green('\n  No changes detected — database is up to date.'))
    return
  }

  console.log(`\n  ${diff.length} changes detected:\n`)

  const byCategory = new Map<string, DiffEntry[]>()
  for (const entry of diff) {
    const list = byCategory.get(entry.category) ?? []
    list.push(entry)
    byCategory.set(entry.category, list)
  }

  for (const [category, catEntries] of byCategory) {
    console.log(chalk.bold(`  ${category.toUpperCase()}`))
    for (const entry of catEntries) {
      let icon: string, label: string
      if (entry.type === 'added') {
        icon = chalk.green('+'); label = chalk.green(entry.label)
      } else if (entry.type === 'removed') {
        icon = chalk.red('-'); label = chalk.red(entry.label)
      } else if (entry.type === 'rescheduled') {
        icon = chalk.magenta('↻'); label = chalk.magenta(entry.label)
      } else {
        icon = chalk.yellow('~'); label = chalk.yellow(entry.label)
      }
      const details = entry.details ? chalk.dim(` (${entry.details})`) : ''
      console.log(`    ${icon} ${label}${details}`)
    }
    console.log()
  }
}

function printFlags(flags: Flag[]): void {
  if (flags.length === 0) return

  const reschedules = flags.filter(f => f.level === 'reschedule').length
  const removals = flags.filter(f => f.level === 'removal').length
  const warnings = flags.filter(f => f.level === 'warn' || f.level === 'info').length

  const counts: string[] = []
  if (reschedules > 0) counts.push(`${reschedules} reschedule${reschedules > 1 ? 's' : ''}`)
  if (removals > 0) counts.push(`${removals} removal${removals > 1 ? 's' : ''}`)
  if (warnings > 0) counts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`)

  console.log(chalk.bold(`\n  FLAGS (${counts.join(', ')}):\n`))
  for (const f of flags) {
    if (f.level === 'reschedule') {
      console.log(`    ${chalk.magenta('⚠ RESCHEDULE:')} ${chalk.magenta(f.message)}`)
    } else if (f.level === 'removal') {
      console.log(`    ${chalk.red('✕ REMOVED:')} ${chalk.red(f.message)}`)
    } else if (f.level === 'warn') {
      console.log(`    ${chalk.yellow('!')} ${chalk.yellow(f.message)}`)
    } else {
      console.log(`    ${chalk.blue('i')} ${chalk.dim(f.message)}`)
    }
  }
  console.log()
}

// ── Step 4: Generate SQL ─────────────────────────────────────────────────────

function escSql(s: string): string {
  return s.replace(/'/g, "''")
}

function stageWhereFragment(stageName: string | null): string {
  return stageName
    ? `stage_id = (stage_ids->>'${escSql(stageName)}')::uuid`
    : 'stage_id IS NULL'
}

function existingSetWhere(e: ExistingSetInfo): string {
  return `festival_id = fest_id AND artist_name = '${escSql(e.artist_name)}' AND day = '${e.day}' AND ${stageWhereFragment(e.stage_name)}`
}

function generateSql(scraped: ScrapedData, setDiff: SetDiff): string {
  const lines: string[] = []
  const slug = scraped.festival.slug
  const f = scraped.festival

  lines.push(`-- Auto-generated by ingest.ts on ${new Date().toISOString().split('T')[0]}`)
  lines.push(`-- Source: ${f.website_url}`)
  lines.push(`-- Festival: ${f.name}`)
  lines.push('')

  // Festival upsert
  lines.push('-- Festival')
  lines.push(`INSERT INTO festivals (name, slug, location, start_date, end_date, timetable_announced)`)
  lines.push(`VALUES ('${escSql(f.name)}', '${escSql(slug)}', ${f.location ? `'${escSql(f.location)}'` : 'NULL'}, '${f.start_date}', '${f.end_date}', ${f.timetable_announced})`)
  lines.push(`ON CONFLICT (slug) DO UPDATE SET`)
  lines.push(`  name = EXCLUDED.name,`)
  lines.push(`  location = EXCLUDED.location,`)
  lines.push(`  start_date = EXCLUDED.start_date,`)
  lines.push(`  end_date = EXCLUDED.end_date,`)
  lines.push(`  timetable_announced = EXCLUDED.timetable_announced;`)
  lines.push('')

  lines.push(`DO $$ DECLARE fest_id uuid; stage_ids jsonb := '{}'; set_uuid uuid; artist_uuid uuid;`)
  lines.push(`BEGIN`)
  lines.push(`  SELECT id INTO fest_id FROM festivals WHERE slug = '${escSql(slug)}';`)
  lines.push('')

  // Stages
  if (scraped.stages.length > 0) {
    lines.push('  -- Stages')
    for (const stage of scraped.stages) {
      lines.push(`  INSERT INTO stages (festival_id, name, sort_order)`)
      lines.push(`  VALUES (fest_id, '${escSql(stage.name)}', ${stage.sort_order})`)
      lines.push(`  ON CONFLICT (festival_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order;`)
      lines.push('')
    }
    lines.push(`  SELECT jsonb_object_agg(name, id) INTO stage_ids FROM stages WHERE festival_id = fest_id;`)
    lines.push('')
  }

  // Clear set_artists (will re-insert below; no user data lost)
  lines.push('  -- Clear set_artists (re-inserted below; no user-facing data)')
  lines.push(`  DELETE FROM set_artists WHERE set_id IN (SELECT id FROM sets WHERE festival_id = fest_id);`)
  lines.push('')

  // Updated sets — time/is_live changes only (preserves set ID → user_plans survive)
  if (setDiff.updated.length > 0) {
    lines.push(`  -- Updated sets (${setDiff.updated.length} — preserves set ID)`)
    for (const { scraped: s, existing: e, changes } of setDiff.updated) {
      const setClauses: string[] = []
      if (normalizeTime(s.start_time) !== normalizeTime(e.start_time))
        setClauses.push(`start_time = ${s.start_time ? `'${s.start_time}'` : 'NULL'}`)
      if (normalizeTime(s.end_time) !== normalizeTime(e.end_time))
        setClauses.push(`end_time = ${s.end_time ? `'${s.end_time}'` : 'NULL'}`)
      if (s.is_live !== e.is_live)
        setClauses.push(`is_live = ${s.is_live}`)
      if (setClauses.length > 0) {
        lines.push(`  -- ${changes.join(', ')}`)
        lines.push(`  UPDATE sets SET ${setClauses.join(', ')} WHERE ${existingSetWhere(e)};`)
        lines.push('')
      }
    }
  }

  // Rescheduled sets — day/stage changed (preserves set ID → user_plans move with it)
  if (setDiff.rescheduled.length > 0) {
    lines.push(`  -- Rescheduled sets (${setDiff.rescheduled.length} — preserves set ID, user_plans move)`)
    for (const { scraped: s, existing: e } of setDiff.rescheduled) {
      const stageRef = s.stage ? `(stage_ids->>'${escSql(s.stage)}')::uuid` : 'NULL'
      const startTime = s.start_time ? `'${s.start_time}'` : 'NULL'
      const endTime = s.end_time ? `'${s.end_time}'` : 'NULL'
      lines.push(`  -- ⚠ RESCHEDULE: was ${e.stage_name ?? 'no stage'} / ${e.day} ${e.start_time ?? ''}`)
      lines.push(`  UPDATE sets SET day = '${s.day}', stage_id = ${stageRef}, start_time = ${startTime}, end_time = ${endTime}, is_live = ${s.is_live}`)
      lines.push(`    WHERE ${existingSetWhere(e)};`)
      lines.push('')
    }
  }

  // New sets
  if (setDiff.added.length > 0) {
    lines.push(`  -- New sets (${setDiff.added.length})`)
    for (const set of setDiff.added) {
      const stageRef = set.stage ? `(stage_ids->>'${escSql(set.stage)}')::uuid` : 'NULL'
      const startTime = set.start_time ? `'${set.start_time}'` : 'NULL'
      const endTime = set.end_time ? `'${set.end_time}'` : 'NULL'
      lines.push(`  INSERT INTO sets (festival_id, stage_id, artist_name, day, start_time, end_time, is_live)`)
      lines.push(`  VALUES (fest_id, ${stageRef}, '${escSql(set.artist_name)}', '${set.day}', ${startTime}, ${endTime}, ${set.is_live});`)
      lines.push('')
    }
  }

  // Removed sets
  if (setDiff.removed.length > 0) {
    lines.push(`  -- Removed sets (${setDiff.removed.length} — cascades user_plans/ratings)`)
    for (const e of setDiff.removed) {
      lines.push(`  DELETE FROM sets WHERE ${existingSetWhere(e)};`)
      lines.push('')
    }
  }

  // Artists
  lines.push('  -- Artists (parsed from set artist_name strings)')
  const processedArtists = new Set<string>()
  const scrapedBios = new Map(
    scraped.artists.map(a => [a.name.toLowerCase(), a])
  )

  for (const set of scraped.sets) {
    const parsed = parseArtistName(set.artist_name)

    if (parsed.collective) {
      const sortName = parsed.collective.toLowerCase().trim()
      if (!processedArtists.has(sortName)) {
        processedArtists.add(sortName)
        const scraperArtist = scrapedBios.get(sortName)
        const bio = scraperArtist?.bio
        const sourceUrl = scraperArtist?.source_url
        lines.push(`  INSERT INTO artists (name, sort_name, is_collective${bio ? ', bio' : ''}${sourceUrl ? ', source_url' : ''})`)
        lines.push(`  VALUES ('${escSql(parsed.collective)}', '${escSql(sortName)}', true${bio ? `, '${escSql(bio)}'` : ''}${sourceUrl ? `, '${escSql(sourceUrl)}'` : ''})`)
        lines.push(`  ON CONFLICT (sort_name) DO UPDATE SET`)
        lines.push(`    bio = CASE WHEN EXCLUDED.bio IS NOT NULL AND (artists.bio IS NULL OR length(EXCLUDED.bio) > length(artists.bio)) THEN EXCLUDED.bio ELSE artists.bio END,`)
        lines.push(`    source_url = COALESCE(EXCLUDED.source_url, artists.source_url);`)
        lines.push('')
      }
    }

    for (const member of parsed.members) {
      const sortName = member.toLowerCase().trim()
      if (!sortName || processedArtists.has(sortName)) continue
      processedArtists.add(sortName)
      const scraperArtist = scrapedBios.get(sortName)
      const bio = scraperArtist?.bio
      const sourceUrl = scraperArtist?.source_url
      lines.push(`  INSERT INTO artists (name, sort_name, is_collective${bio ? ', bio' : ''}${sourceUrl ? ', source_url' : ''})`)
      lines.push(`  VALUES ('${escSql(member)}', '${escSql(sortName)}', false${bio ? `, '${escSql(bio)}'` : ''}${sourceUrl ? `, '${escSql(sourceUrl)}'` : ''})`)
      lines.push(`  ON CONFLICT (sort_name) DO UPDATE SET`)
      lines.push(`    bio = CASE WHEN EXCLUDED.bio IS NOT NULL AND (artists.bio IS NULL OR length(EXCLUDED.bio) > length(artists.bio)) THEN EXCLUDED.bio ELSE artists.bio END,`)
      lines.push(`    source_url = COALESCE(EXCLUDED.source_url, artists.source_url);`)
      lines.push('')
    }
  }

  // Set → artist links (for all current scraped sets)
  lines.push('  -- Set-artist links')
  for (const set of scraped.sets) {
    const parsed = parseArtistName(set.artist_name)
    const setWhere = `festival_id = fest_id AND artist_name = '${escSql(set.artist_name)}' AND day = '${set.day}' AND ${stageWhereFragment(set.stage)}`
    lines.push(`  SELECT id INTO set_uuid FROM sets WHERE ${setWhere};`)

    if (parsed.collective) {
      const sortName = parsed.collective.toLowerCase().trim()
      lines.push(`  SELECT id INTO artist_uuid FROM artists WHERE sort_name = '${escSql(sortName)}';`)
      lines.push(`  INSERT INTO set_artists (set_id, artist_id, role, billing_order)`)
      lines.push(`  VALUES (set_uuid, artist_uuid, 'collab', 0)`)
      lines.push(`  ON CONFLICT (set_id, artist_id) DO NOTHING;`)
    }

    parsed.members.forEach((member, i) => {
      const sortName = member.toLowerCase().trim()
      if (!sortName) return
      lines.push(`  SELECT id INTO artist_uuid FROM artists WHERE sort_name = '${escSql(sortName)}';`)
      lines.push(`  INSERT INTO set_artists (set_id, artist_id, role, billing_order)`)
      lines.push(`  VALUES (set_uuid, artist_uuid, '${parsed.role}', ${i + 1})`)
      lines.push(`  ON CONFLICT (set_id, artist_id) DO NOTHING;`)
    })
    lines.push('')
  }

  lines.push('END $$;')
  return lines.join('\n')
}

function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(chalk.bold(`\n  ${question} [y/N] `), answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const scraped = await getScrapedData()

    // Save scraped JSON for debugging
    const jsonPath = `scraped/${scraped.festival.slug}.json`
    if (!existsSync('scraped')) {
      mkdirSync('scraped', { recursive: true })
    }
    writeFileSync(jsonPath, JSON.stringify(scraped, null, 2))
    console.log(chalk.dim(`\n  Saved scraped data to ${jsonPath}`))

    // Fetch current state
    console.log('\n  Fetching current database state...')
    const current = await fetchCurrentState(scraped.festival.slug)
    console.log(current.festival
      ? `  Found existing festival: ${current.festival.name} (${current.sets.length} sets, ${current.stages.length} stages)`
      : '  Festival not in database yet — full insert')

    // Diff + flags
    const { entries: diff, setDiff } = computeDiff(scraped, current)
    const flags = computeFlags(scraped, setDiff)
    printDiff(diff)
    printFlags(flags)

    if (diff.length === 0) {
      console.log('No changes detected — nothing to do.')
      return
    }

    if (dryRun) {
      console.log(chalk.yellow('Dry run complete — no SQL generated. Run without --dry-run to generate.'))
      return
    }

    // Confirm before generating SQL
    const answer = await confirm(`Generate SQL migration for ${diff.length} changes?`)
    if (!answer) {
      console.log(chalk.dim('Aborted — no SQL generated.'))
      return
    }

    const sql = generateSql(scraped, setDiff)
    const migrationNum = getNextMigrationNumber()
    const filename = `${migrationNum}_${scraped.festival.slug.replace(/-/g, '_')}.sql`
    const outputPath = `supabase/migrations/${filename}`
    writeFileSync(outputPath, sql)
    console.log(chalk.green(`\n  SQL written to ${outputPath}`))
    console.log(chalk.dim('  Review the file, then run in Supabase SQL Editor to apply.'))
  } finally {
    await closeBrowser()
  }
}

function getNextMigrationNumber(): string {
  const dir = 'supabase/migrations'
  if (!existsSync(dir)) return '007'
  const files = readdirSync(dir) as string[]
  const numbers = files
    .map((f: string) => parseInt(f.match(/^(\d+)/)?.[1] ?? '0', 10))
    .filter((n: number) => !isNaN(n))
  const max = Math.max(0, ...numbers)
  return String(max + 1).padStart(3, '0')
}

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err)
  process.exit(1)
})
