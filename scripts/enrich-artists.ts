#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import { createInterface } from 'node:readline'
import { enrichArtist, type PipelineConfig } from './lib/enrichment/pipeline.js'
import { writeReviewFile, readReviewFile, loadProgress, saveProgress, clearProgress, writeBioResearchFiles } from './lib/enrichment/review.js'
import { isComboEntry } from './lib/enrichment/name-utils.js'
import type { EnrichmentField, EnrichmentResult, ArtistRow, BioResearch, BioSource } from './lib/enrichment/types.js'
import { generateArtistBio } from './lib/enrichment/bio-generator.js'

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const festivalArg = args.find(a => a.startsWith('--festival='))?.split('=').slice(1).join('=')
const artistArg = args.find(a => a.startsWith('--artist='))?.split('=').slice(1).join('=')
const applyArg = args.find(a => a.startsWith('--apply='))?.split('=').slice(1).join('=')
const fieldsArg = args.find(a => a.startsWith('--fields='))?.split('=').slice(1).join('=')
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const fresh = args.includes('--fresh')
const resume = args.includes('--resume')
const autoApply = args.includes('--auto-apply')
const pollJobs = args.includes('--poll-jobs')
const pollInterval = parseInt(args.find(a => a.startsWith('--poll-interval='))?.split('=')[1] ?? '30', 10)
const searchKeywords = args.find(a => a.startsWith('--search-keywords='))?.split('=').slice(1).join('=') || undefined

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  npm run enrich                                    Enrich all unenriched artists
  npm run enrich -- --festival=<slug>               One festival only
  npm run enrich -- --artist="speedy-j"              Single artist by sort_name
  npm run enrich -- --artist="a,b,c"                Multiple artists (comma-separated sort_names)
  npm run enrich -- --dry-run                       Preview, no DB writes
  npm run enrich -- --force                         Re-enrich all (ignore enriched_at)
  npm run enrich -- --fresh                         Ignore existing field values (fetch everything from scratch)
  npm run enrich -- --limit=30                      Process max N artists
  npm run enrich -- --resume                        Continue from last saved progress
  npm run enrich -- --fields=bandcamp               Only fetch specific fields
  npm run enrich -- --fields=instagram,image        Comma-separated field list
  npm run enrich -- --apply=enrichment-review/X.json  Apply reviewed file to DB
  npm run enrich -- --auto-apply                       Write results directly to DB (no manual --apply step)
  npm run enrich -- --poll-jobs                        Poll enrichment_jobs table for pending jobs
  npm run enrich -- --poll-jobs --poll-interval=60     Custom poll interval (seconds, default: 30)
  npm run enrich -- --search-keywords="drum & bass"   Append keywords to Brave search queries

Fields: image, instagram, soundcloud, bandcamp, bio, location`)
  process.exit(0)
}

const fields = fieldsArg
  ? fieldsArg.split(',').map(f => f.trim()) as EnrichmentField[]
  : undefined
const limit = limitArg ? parseInt(limitArg, 10) : undefined

console.log('earrands — Artist Enrichment')
console.log('──────────────────────────────────')
if (dryRun) console.log(chalk.yellow('DRY RUN — no DB writes'))
if (fresh) console.log(chalk.yellow('FRESH — ignoring existing field values'))
if (fields) console.log(chalk.dim(`Fields: ${fields.join(', ')}`))
if (searchKeywords) console.log(chalk.dim(`Search keywords: ${searchKeywords}`))
if (limit) console.log(chalk.dim(`Limit: ${limit} artists`))
if (resume) console.log(chalk.dim('Resuming from last progress'))
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

// ── Config ───────────────────────────────────────────────────────────────────

const braveApiKey = process.env.BRAVE_API_KEY
const discogsKey = process.env.DISCOGS_CONSUMER_KEY
const discogsSecret = process.env.DISCOGS_CONSUMER_SECRET
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN

if (!braveApiKey) {
  console.warn(chalk.yellow('BRAVE_API_KEY not set — Brave web search disabled'))
}
if (!discogsKey || !discogsSecret) {
  console.warn(chalk.yellow('DISCOGS_CONSUMER_KEY or DISCOGS_CONSUMER_SECRET not set — Discogs disabled'))
}
if ((!cloudflareAccountId || !cloudflareApiToken) && (!fields || fields.includes('image'))) {
  console.warn(chalk.yellow('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not set — image scoring disabled (using priority fallback)'))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(chalk.bold(`\n  ${question} [y/N] `), answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

function deriveBioSources(research: BioResearch, soundcloudUrl: string | null, discogsId: number | null): BioSource[] {
  const sources: BioSource[] = []
  if (research.soundcloud_bio) sources.push({ url: soundcloudUrl ?? '', title: 'SoundCloud', snippet: research.soundcloud_bio.slice(0, 200), type: 'soundcloud' })
  if (research.discogs_bio) sources.push({ url: `https://www.discogs.com/artist/${discogsId}`, title: 'Discogs', snippet: research.discogs_bio.slice(0, 200), type: 'discogs' })
  if (research.festival_bio) sources.push({ url: '', title: 'Festival', snippet: research.festival_bio.slice(0, 200), type: 'festival' })
  sources.push(...research.web_sources)
  return sources
}

// ── Apply mode ───────────────────────────────────────────────────────────────

async function applyReviewFile(path: string) {
  const review = readReviewFile(path)
  const toApply = review.artists.filter(a =>
    !a.review_notes.includes('Skipped: combo/temporary entry') &&
    (a.image_url || a.instagram_url || a.soundcloud_url || a.soundcloud_embed_url || a.bandcamp_url || a.city || a.bio)
  )

  console.log(`  Review file: ${path}`)
  console.log(`  Artists to update: ${toApply.length}`)

  if (toApply.length === 0) {
    console.log(chalk.dim('  Nothing to apply.'))
    return
  }

  if (dryRun) {
    for (const a of toApply) {
      const parts: string[] = []
      if (a.image_url) parts.push('img')
      if (a.instagram_url) parts.push('ig')
      if (a.soundcloud_url) parts.push('sc')
      if (a.soundcloud_embed_url) parts.push('embed')
      if (a.bandcamp_url) parts.push('bc')
      if (a.city) parts.push('loc')
      if (a.bio) parts.push('bio')
      console.log(`    ${chalk.green('✓')} ${a.display_name} [${parts.join(', ')}]`)
    }
    console.log(chalk.yellow('\n  Dry run — no DB writes.'))
    return
  }

  if (!autoApply) {
    const ok = await confirm(`Apply enrichment data for ${toApply.length} artists?`)
    if (!ok) {
      console.log(chalk.dim('  Aborted.'))
      return
    }
  }

  let updated = 0
  for (const a of toApply) {
    const updateData: Record<string, any> = {
      image_url: a.image_url,
      instagram_url: a.instagram_url,
      soundcloud_url: a.soundcloud_url,
      soundcloud_embed_url: a.soundcloud_embed_url,
      bandcamp_url: a.bandcamp_url,
      discogs_id: a.discogs_id,
      enriched_at: new Date().toISOString(),
    }
    if (a.city) updateData.city = a.city
    if (a.country_code) updateData.country_code = a.country_code
    if (a.bio_research) {
      updateData.bio_research = a.bio_research
      // Derive flat source list for admin provenance display
      updateData.bio_sources = deriveBioSources(a.bio_research, a.soundcloud_url, a.discogs_id)
    }

    const { error } = await supabase
      .from('artists')
      .update(updateData)
      .eq('sort_name', a.sort_name)

    if (error) {
      console.error(chalk.red(`  ✕ ${a.display_name}: ${error.message}`))
    } else {
      updated++
    }
  }

  console.log(chalk.green(`\n  Updated ${updated}/${toApply.length} artists.`))
}

// ── Fetch artists ────────────────────────────────────────────────────────────

let festivalName: string | undefined

async function fetchArtists(): Promise<ArtistRow[]> {
  let query = supabase
    .from('artists')
    .select('id, name, sort_name, is_collective, image_url, instagram_url, soundcloud_url, soundcloud_embed_url, bandcamp_url, discogs_id, enriched_at, bio, city, country_code, enrichment_status')

  if (artistArg) {
    const names = artistArg.split(',').map(n => n.trim()).filter(Boolean)
    query = query.in('sort_name', names)
  }

  if (festivalArg) {
    const { data: festival } = await supabase
      .from('festivals')
      .select('id, name')
      .eq('slug', festivalArg)
      .single()

    if (!festival) {
      console.error(chalk.red(`Festival not found: ${festivalArg}`))
      process.exit(1)
    }
    festivalName = festival.name

    const { data: setIds } = await supabase
      .from('sets')
      .select('id')
      .eq('festival_id', festival.id)

    if (!setIds || setIds.length === 0) {
      console.log(chalk.dim('No sets found for this festival.'))
      process.exit(0)
    }

    const { data: artistIds } = await supabase
      .from('set_artists')
      .select('artist_id')
      .in('set_id', setIds.map(s => s.id))

    if (!artistIds || artistIds.length === 0) {
      console.log(chalk.dim('No artists linked to this festival.'))
      process.exit(0)
    }

    const uniqueIds = [...new Set(artistIds.map(a => a.artist_id))]
    query = query.in('id', uniqueIds)
  }

  if (!force && !artistArg) {
    query = query.is('enriched_at', null)
  }

  const { data, error } = await query.order('sort_name')
  if (error) {
    console.error(chalk.red(`DB error: ${error.message}`))
    process.exit(1)
  }

  return (data ?? []) as ArtistRow[]
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (applyArg) {
    await applyReviewFile(applyArg)
    return
  }

  let artists = await fetchArtists()

  // Filter out combo entries
  artists = artists.filter(a => !isComboEntry(a.sort_name, a.is_collective))

  // Handle resume
  if (resume) {
    const progress = loadProgress(festivalArg ?? null)
    const completed = new Set(progress.completed_sort_names)
    const before = artists.length
    artists = artists.filter(a => !completed.has(a.sort_name))
    if (before !== artists.length) {
      console.log(chalk.dim(`  Resuming: skipping ${before - artists.length} already-processed artists`))
    }
  } else {
    clearProgress(festivalArg ?? null)
  }

  // Apply limit
  if (limit && artists.length > limit) {
    console.log(chalk.dim(`  Processing ${limit} of ${artists.length} artists (--limit=${limit})`))
    artists = artists.slice(0, limit)
  }

  console.log(`  Found ${artists.length} artists to enrich`)
  if (artists.length === 0) {
    console.log(chalk.dim('  Nothing to do.'))
    return
  }

  const config: PipelineConfig = {
    braveApiKey,
    discogsKey,
    discogsSecret,
    cloudflareAccountId,
    cloudflareApiToken,
    festivalName,
    fields,
    dryRun,
    searchKeywords,
    onProgress: (artist, step) => {
      process.stdout.write(`\r  ${chalk.dim(`[${step}]`)} ${artist}${''.padEnd(30)}`)
    },
  }

  const results: EnrichmentResult[] = []
  const completedNames: string[] = resume
    ? loadProgress(festivalArg ?? null).completed_sort_names
    : []

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i]
    const progress = `[${i + 1}/${artists.length}]`
    process.stdout.write(`\r  ${chalk.bold(progress)} ${artist.name}${''.padEnd(40)}`)

    try {
      const artistToEnrich = fresh ? {
        ...artist,
        image_url: null,
        instagram_url: null,
        soundcloud_url: null,
        soundcloud_embed_url: null,
        bandcamp_url: null,
        discogs_id: null,
        city: null,
        country_code: null,
      } : artist
      const result = await enrichArtist(artistToEnrich, config)
      results.push(result)
      completedNames.push(artist.sort_name)
      saveProgress(festivalArg ?? null, completedNames)

      // Status indicator
      const parts: string[] = []
      if (result.image_url) parts.push('img')
      if (result.instagram_url) parts.push('ig')
      if (result.soundcloud_url) parts.push('sc')
      if (result.soundcloud_embed_url) parts.push('embed')
      if (result.bandcamp_url) parts.push('bc')
      if (result.city) parts.push('loc')
      if (result.bio_research) parts.push('bio-res')

      const status = parts.length > 0
        ? chalk.green(`✓ [${parts.join(', ')}]`)
        : result.review_notes.includes('Skipped: combo/temporary entry')
          ? chalk.dim('skip')
          : chalk.yellow('✕ not found')

      console.log(`\r  ${chalk.bold(progress)} ${artist.name} ${status}${''.padEnd(20)}`)
    } catch (err: any) {
      if (err.message?.includes('quota exceeded') || err.message?.includes('rate limit')) {
        console.log(chalk.red(`\n\n  ${err.message}`))
        console.log(chalk.yellow(`  Processed ${i} of ${artists.length}. Use --resume to continue later.`))
        break
      }
      console.log(`\r  ${chalk.bold(progress)} ${artist.name} ${chalk.red(`error: ${err.message}`)}`)
      results.push({
        sort_name: artist.sort_name,
        display_name: artist.name,
        image_url: null,
        instagram_url: null,
        soundcloud_url: null,
        soundcloud_embed_url: null,
        bandcamp_url: null,
        discogs_id: null,
        city: null,
        country_code: null,
        bio: null,
        bio_source: null,
        bio_festival: null,
        bio_sources: null,
        bio_research: null,
        confidence: 'low',
        sources: [],
        needs_review: true,
        review_notes: [`Pipeline error: ${err.message}`],
      })
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n')
  const enriched = results.filter(r => r.soundcloud_url || r.instagram_url || r.image_url)
  const needsReview = results.filter(r => r.needs_review)
  const notFound = results.filter(r => !r.soundcloud_url && !r.instagram_url && !r.image_url && !r.review_notes.includes('Skipped: combo/temporary entry'))

  console.log(chalk.bold('  Summary'))
  console.log(`    Total:        ${results.length}`)
  console.log(`    Enriched:     ${chalk.green(String(enriched.length))}`)
  console.log(`    Needs review: ${chalk.yellow(String(needsReview.length))}`)
  console.log(`    Not found:    ${chalk.red(String(notFound.length))}`)

  // Write review file
  const reviewPath = writeReviewFile(festivalArg ?? null, results)
  console.log(chalk.dim(`\n  Review file: ${reviewPath}`))

  // Write bio research chunks if bio field was requested
  const bioChunkPaths = writeBioResearchFiles(festivalArg ?? null, results)
  if (bioChunkPaths.length > 0) {
    console.log(chalk.dim(`  Bio research: ${bioChunkPaths.length} chunk(s)`))
    for (const p of bioChunkPaths) {
      console.log(chalk.dim(`    ${p}`))
    }
  }

  if (dryRun) {
    console.log(chalk.yellow('\n  Dry run complete — review the file, then run with --apply to write to DB.'))
    return
  }

  if (enriched.length === 0) {
    console.log(chalk.dim('  No enrichment data found.'))
    return
  }

  if (autoApply) {
    console.log(chalk.dim('\n  Auto-applying results to DB...'))
    await applyReviewFile(reviewPath)
  } else {
    console.log(chalk.dim(`\n  Review the file, then run:`))
    console.log(chalk.dim(`    npm run enrich -- --apply=${reviewPath}`))
  }

  // Generate AI bios from research using Claude CLI
  const withResearch = results.filter(r => r.bio_research && (
    r.bio_research.web_sources.length > 0 ||
    r.bio_research.soundcloud_bio ||
    r.bio_research.discogs_bio ||
    r.bio_research.festival_bio
  ))
  if (withResearch.length > 0 && !dryRun) {
    console.log(chalk.dim(`\n  Generating AI bios for ${withResearch.length} artist(s)...`))
    let generated = 0
    for (const r of withResearch) {
      process.stdout.write(`\r  ${chalk.dim('[AI bio]')} ${r.display_name}${''.padEnd(30)}`)
      const bio = generateArtistBio(r.display_name, r.bio_research!)
      if (bio) {
        const { error } = await supabase
          .from('artists')
          .update({ bio_generated: bio })
          .eq('sort_name', r.sort_name)
        if (error) {
          console.error(chalk.red(`\n  ✕ ${r.display_name} bio_generated: ${error.message}`))
        } else {
          generated++
        }
      } else {
        console.log(chalk.dim(`\r  ${chalk.yellow('–')} ${r.display_name}: insufficient sources for bio${''.padEnd(20)}`))
      }
    }
    console.log(`\r  ${chalk.green(`Generated ${generated}/${withResearch.length} AI bios`)}${''.padEnd(30)}`)
  }
}

// ── Poll Jobs Mode ──────────────────────────────────────────────────────────

async function pollJobsLoop() {
  console.log(chalk.bold(`  Polling enrichment_jobs every ${pollInterval}s — Ctrl+C to stop\n`))

  while (true) {
    const { data: jobs, error } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at')
      .limit(1)

    if (error) {
      console.error(chalk.red(`  DB error: ${error.message}`))
    } else if (jobs && jobs.length > 0) {
      const job = jobs[0]
      console.log(chalk.bold(`  Picked up job ${job.id} (${job.type})`))

      // Mark as running
      await supabase
        .from('enrichment_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', job.id)

      try {
        // Build CLI args from job params
        const jobArgs: string[] = []
        if (job.festival_slug) jobArgs.push(`--festival=${job.festival_slug}`)
        if (job.fields?.length) jobArgs.push(`--fields=${job.fields.join(',')}`)
        if (job.artist_sort_names?.length) {
          jobArgs.push(`--artist=${job.artist_sort_names.join(',')}`)
        }
        if (job.search_keywords) jobArgs.push(`--search-keywords=${job.search_keywords}`)

        // For parse_artists type, run parse-artists script instead
        if (job.type === 'parse_artists') {
          const { execFileSync } = await import('node:child_process')
          const parseArgs = ['tsx', 'scripts/parse-artists.ts', ...(job.festival_slug ? [`--festival=${job.festival_slug}`] : [])]
          console.log(chalk.dim(`  Running: npx ${parseArgs.join(' ')}`))
          execFileSync('npx', parseArgs, { stdio: 'inherit', env: process.env })
        } else {
          const { execFileSync } = await import('node:child_process')
          const enrichArgs = ['tsx', 'scripts/enrich-artists.ts', ...jobArgs, '--auto-apply']
          console.log(chalk.dim(`  Running: npx ${enrichArgs.join(' ')}`))
          execFileSync('npx', enrichArgs, { stdio: 'inherit', env: process.env })
        }

        await supabase
          .from('enrichment_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_summary: { message: 'Completed via --poll-jobs' },
          })
          .eq('id', job.id)

        console.log(chalk.green(`  Job ${job.id} completed\n`))
      } catch (err: any) {
        await supabase
          .from('enrichment_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: err.message ?? String(err),
          })
          .eq('id', job.id)

        console.error(chalk.red(`  Job ${job.id} failed: ${err.message}\n`))
      }
    } else {
      process.stdout.write(chalk.dim(`\r  No pending jobs — waiting ${pollInterval}s...`))
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval * 1000))
  }
}

if (pollJobs) {
  pollJobsLoop().catch(err => {
    console.error(chalk.red('Fatal error:'), err)
    process.exit(1)
  })
} else {
  main().then(() => {
    process.exit(0)
  }).catch(err => {
    console.error(chalk.red('Fatal error:'), err)
    process.exit(1)
  })
}
