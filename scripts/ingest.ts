#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { findAdapter } from './scrapers/index.js'
import { closeBrowser } from './scrapers/base.js'
import { computeDiff, computeFlags, generateSql, type DbState, type DiffEntry, type Flag } from './lib/ingest-diff.js'
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

// ── Step 3: Compute diff (logic in lib/ingest-diff.ts) ──────────────────────

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
