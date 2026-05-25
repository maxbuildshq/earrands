#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { findAdapter } from './scrapers/index.js'
import { closeBrowser } from './scrapers/base.js'
import { parseArtistName } from './lib/artist-parser.js'
import type { ScrapedData } from './scrapers/types.js'

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
  type: 'added' | 'removed' | 'changed'
  category: string
  label: string
  details?: string
}

function normalizeTime(t: string | null): string | null {
  if (!t) return null
  return t.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1') // "13:00:00" → "13:00", "13:00" unchanged
}

function normalizeText(t: string): string {
  return t.replace(/[‘’′]/g, "'").replace(/[“”]/g, '"')
}

function computeDiff(scraped: ScrapedData, current: DbState): DiffEntry[] {
  const diff: DiffEntry[] = []

  // Festival
  if (!current.festival) {
    diff.push({ type: 'added', category: 'festival', label: scraped.festival.name })
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
      diff.push({ type: 'changed', category: 'festival', label: s.name, details: changes.join(', ') })
    }
  }

  // Stages
  const currentStageNames = new Set(current.stages.map(s => s.name))
  const scrapedStageNames = new Set(scraped.stages.map(s => s.name))

  for (const stage of scraped.stages) {
    if (!currentStageNames.has(stage.name)) {
      diff.push({ type: 'added', category: 'stage', label: stage.name })
    }
  }
  for (const stage of current.stages) {
    if (!scrapedStageNames.has(stage.name)) {
      diff.push({ type: 'removed', category: 'stage', label: stage.name })
    }
  }

  // Sets — match by stage + day + start_time (timetable) or artist_name + day (lineup-only)
  const stageIdToName = new Map(current.stages.map(s => [s.id, s.name]))

  function setKey(artistName: string, day: string, stage: string | null, startTime: string | null): string {
    if (stage && startTime) {
      return `${stage}|${day}|${normalizeTime(startTime)}`
    }
    return `${normalizeText(artistName)}|${day}`
  }

  const currentSetKeys = new Map(current.sets.map(s =>
    [setKey(s.artist_name, s.day, stageIdToName.get(s.stage_id ?? '') ?? null, s.start_time), s]
  ))
  const scrapedSetKeys = new Set<string>()

  for (const set of scraped.sets) {
    const key = setKey(set.artist_name, set.day, set.stage, set.start_time)
    scrapedSetKeys.add(key)
    const existing = currentSetKeys.get(key)
    if (!existing) {
      diff.push({ type: 'added', category: 'set', label: `${set.artist_name} (${set.day})`, details: set.stage ? `${set.stage} ${set.start_time}-${set.end_time}` : undefined })
    } else {
      const changes: string[] = []
      if (normalizeText(set.artist_name) !== normalizeText(existing.artist_name)) changes.push(`artist: "${existing.artist_name}" → "${set.artist_name}"`)
      if (normalizeTime(set.end_time) !== normalizeTime(existing.end_time)) changes.push(`end: ${existing.end_time} → ${set.end_time}`)
      if (set.is_live !== existing.is_live) changes.push(`live: ${existing.is_live} → ${set.is_live}`)
      if (changes.length > 0) {
        diff.push({ type: 'changed', category: 'set', label: `${set.artist_name} (${set.day})`, details: changes.join(', ') })
      }
    }
  }

  for (const [key, set] of currentSetKeys) {
    if (!scrapedSetKeys.has(key)) {
      diff.push({ type: 'removed', category: 'set', label: `${set.artist_name} (${set.day})` })
    }
  }

  // Artists — bio updates
  const currentArtistBios = new Map(current.artists.map(a => [a.sort_name, a]))
  for (const artist of scraped.artists) {
    if (!artist.bio) continue
    const existing = currentArtistBios.get(artist.name.toLowerCase())
    if (!existing) {
      diff.push({ type: 'added', category: 'artist bio', label: artist.name, details: `${artist.bio.length} chars` })
    } else if (!existing.bio || artist.bio.length > existing.bio.length) {
      diff.push({ type: 'changed', category: 'artist bio', label: artist.name, details: `${existing.bio?.length ?? 0} → ${artist.bio.length} chars` })
    }
  }

  return diff
}

type Warning = {
  level: 'info' | 'warn'
  message: string
}

function computeWarnings(scraped: ScrapedData): Warning[] {
  const warnings: Warning[] = []

  // Multi-artist sets where individual artists lack source URLs
  const artistUrlMap = new Map(scraped.artists.map(a => [a.name.toLowerCase(), a.source_url]))
  for (const set of scraped.sets) {
    const parsed = parseArtistName(set.artist_name)
    if (parsed.members.length <= 1 && !parsed.collective) continue

    const missing = parsed.members.filter(m => !artistUrlMap.has(m.toLowerCase()))
    if (missing.length > 0) {
      warnings.push({
        level: 'warn',
        message: `"${set.artist_name}" — combined link on source site, parsed artists ${missing.map(m => `"${m}"`).join(', ')} have no individual source URL`,
      })
    }
  }

  // Artists scraped with no bio
  const noBio = scraped.artists.filter(a => !a.bio)
  if (noBio.length > 0 && scraped.artists.length > 0) {
    const withBio = scraped.artists.filter(a => a.bio).length
    warnings.push({
      level: 'info',
      message: `${withBio}/${scraped.artists.length} artists have bios; ${noBio.length} artist pages had no bio text`,
    })
  }

  // Sets with no times in a timetable-announced festival
  if (scraped.festival.timetable_announced) {
    const noTimes = scraped.sets.filter(s => !s.start_time)
    if (noTimes.length > 0) {
      warnings.push({
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
      warnings.push({
        level: 'warn',
        message: `Inconsistent casing: ${names.map(n => `"${n}"`).join(' vs ')} — will be stored as "${names[0]}"`,
      })
    }
  }

  return warnings
}

function printWarnings(warnings: Warning[]): void {
  if (warnings.length === 0) return

  console.log(chalk.bold(`\n  WARNINGS (${warnings.length}):\n`))
  for (const w of warnings) {
    const icon = w.level === 'warn' ? chalk.yellow('!') : chalk.blue('i')
    const text = w.level === 'warn' ? chalk.yellow(w.message) : chalk.dim(w.message)
    console.log(`    ${icon} ${text}`)
  }
  console.log()
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

  for (const [category, entries] of byCategory) {
    console.log(chalk.bold(`  ${category.toUpperCase()}`))
    for (const entry of entries) {
      const icon = entry.type === 'added' ? chalk.green('+')
        : entry.type === 'removed' ? chalk.red('-')
        : chalk.yellow('~')
      const label = entry.type === 'added' ? chalk.green(entry.label)
        : entry.type === 'removed' ? chalk.red(entry.label)
        : chalk.yellow(entry.label)
      const details = entry.details ? chalk.dim(` (${entry.details})`) : ''
      console.log(`    ${icon} ${label}${details}`)
    }
    console.log()
  }
}

// ── Step 4: Generate SQL ─────────────────────────────────────────────────────

function escSql(s: string): string {
  return s.replace(/'/g, "''")
}

function generateSql(scraped: ScrapedData): string {
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

  // Need festival ID for subsequent inserts
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
    // Collect stage IDs into a lookup
    lines.push(`  SELECT jsonb_object_agg(name, id) INTO stage_ids FROM stages WHERE festival_id = fest_id;`)
    lines.push('')
  }

  // Sets
  if (scraped.sets.length > 0) {
    lines.push('  -- Sets')
    for (const set of scraped.sets) {
      const stageRef = set.stage ? `(stage_ids->>'${escSql(set.stage)}')::uuid` : 'NULL'
      const startTime = set.start_time ? `'${set.start_time}'` : 'NULL'
      const endTime = set.end_time ? `'${set.end_time}'` : 'NULL'
      lines.push(`  INSERT INTO sets (festival_id, stage_id, artist_name, day, start_time, end_time, is_live)`)
      lines.push(`  VALUES (fest_id, ${stageRef}, '${escSql(set.artist_name)}', '${set.day}', ${startTime}, ${endTime}, ${set.is_live})`)
      lines.push(`  ON CONFLICT (festival_id, stage_id, day, start_time) DO UPDATE SET`)
      lines.push(`    artist_name = EXCLUDED.artist_name,`)
      lines.push(`    end_time = EXCLUDED.end_time,`)
      lines.push(`    is_live = EXCLUDED.is_live;`)
      lines.push('')
    }
  }

  // Artist parsing — inline the parse-artists logic
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

  // Set → artist links
  lines.push('  -- Set-artist links')
  for (const set of scraped.sets) {
    const parsed = parseArtistName(set.artist_name)
    const stageRef = set.stage ? `(stage_ids->>'${escSql(set.stage)}')::uuid` : 'NULL'

    const stageRefLookup = set.stage ? `(stage_ids->>'${escSql(set.stage)}')::uuid` : 'NULL'
    const startTimeLookup = set.start_time ? `'${set.start_time}'` : 'NULL'
    lines.push(`  SELECT id INTO set_uuid FROM sets WHERE festival_id = fest_id AND stage_id = ${stageRefLookup} AND day = '${set.day}' AND start_time = ${startTimeLookup};`)

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

    // Diff + warnings
    const diff = computeDiff(scraped, current)
    const warnings = computeWarnings(scraped)
    printDiff(diff)
    printWarnings(warnings)

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

    const sql = generateSql(scraped)
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
