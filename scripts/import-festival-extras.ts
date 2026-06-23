#!/usr/bin/env node
/**
 * import-festival-extras.ts
 *
 * One-off importer for the "<festival>-extras.json" format produced by manual
 * app-scrape skills (e.g. parsing-hospitality-app): per-set bios + Instagram/
 * SoundCloud links, keyed by stage/day/start_time/artist_name.
 *
 * Writes:
 *  - artists.instagram_url / soundcloud_url — only fills currently-null fields,
 *    matched per individual member by sort_name
 *  - artists.bio / bio_festival / bio_source — attributed per individual member
 *    listed in entry.artists[] (never to a combined "X & Y" entity):
 *      - explicit "Name — text" segments are split out per member
 *      - any remaining unattributed text is assigned to whichever listed
 *        member's name appears most frequently in it (the bio's real subject —
 *        act sheets often reuse one member's bio as the blob for the whole set)
 *    Keep-longest, same convention as ingest.ts. bio_source = 'festival:<slug>'.
 *
 * Usage:
 *   npm run import-extras -- --festival=<slug> --file=scraped/<slug>-extras.json
 *   npm run import-extras -- --festival=<slug> --file=<path> --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { extractFestivalRootName, bioContainsFestivalName } from './lib/ingest-diff.js'

const args = process.argv.slice(2)
const festivalSlug = args.find(a => a.startsWith('--festival='))?.split('=')[1]
const filePath = args.find(a => a.startsWith('--file='))?.split('=').slice(1).join('=')
const dryRun = args.includes('--dry-run')

if (!festivalSlug || !filePath) {
  console.error('Usage: npm run import-extras -- --festival=<slug> --file=<path> [--dry-run]')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

type ExtraArtist = { name: string; instagram_url: string | null; soundcloud_url: string | null }
type ExtraSet = {
  stage: string
  day: string
  start_time: string
  artist_name: string
  bio_raw: string | null
  artists: ExtraArtist[]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countOccurrences(text: string, name: string): number {
  const re = new RegExp(escapeRegex(name), 'gi')
  return (text.match(re) ?? []).length
}

/** Splits bio_raw into per-member text, attributing unprefixed leftovers by name frequency. */
function attributeBioToMembers(bioRaw: string, members: string[]): Map<string, string> {
  const result = new Map<string, string>()
  if (members.length === 1) {
    result.set(members[0], bioRaw.trim())
    return result
  }

  // Find explicit "Name — text" prefix segments, anchored at line start.
  type Match = { member: string; start: number; contentStart: number }
  const matches: Match[] = []
  for (const member of members) {
    const re = new RegExp(`(?:^|\\n)\\s*${escapeRegex(member)}\\s*[—\\-–]\\s*`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(bioRaw))) {
      matches.push({ member, start: m.index, contentStart: m.index + m[0].length })
    }
  }
  matches.sort((a, b) => a.start - b.start)

  if (matches.length === 0) {
    // No explicit prefixes — whole blob belongs to whichever listed member it's actually about.
    const best = members
      .map(m => ({ m, count: countOccurrences(bioRaw, m) }))
      .sort((a, b) => b.count - a.count)[0]
    if (best.count > 0) result.set(best.m, bioRaw.trim())
    return result
  }

  // Leading unprefixed text (before the first match) belongs to whichever
  // unmatched member it mentions most, if any.
  const claimed = new Set(matches.map(m => m.member))
  const unclaimed = members.filter(m => !claimed.has(m))
  if (matches[0].start > 0 && unclaimed.length > 0) {
    const leading = bioRaw.slice(0, matches[0].start).trim()
    const best = unclaimed
      .map(m => ({ m, count: countOccurrences(leading, m) }))
      .sort((a, b) => b.count - a.count)[0]
    if (leading && best.count > 0) result.set(best.m, leading)
  }

  matches.forEach((match, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].start : bioRaw.length
    const segment = bioRaw.slice(match.contentStart, end).trim()
    if (segment) result.set(match.member, segment)
  })

  return result
}

async function main() {
  console.log('🎵 earrands — Festival Extras Importer')
  console.log('──────────────────────────────────')
  if (dryRun) console.log('🔍 DRY RUN — no DB changes will be made')

  const { data: festRow, error: festErr } = await supabase
    .from('festivals')
    .select('id, name')
    .eq('slug', festivalSlug)
    .single()
  if (festErr || !festRow) {
    console.error(`❌ Festival not found: "${festivalSlug}"`)
    process.exit(1)
  }

  const festivalId = festRow.id
  const festivalRootName = extractFestivalRootName(festRow.name)
  const bioSourceTag = `festival:${festivalSlug}`

  const file = JSON.parse(readFileSync(filePath, 'utf-8')) as { sets: ExtraSet[] }
  console.log(`📋 ${file.sets.length} set entries in extras file`)

  const { data: dbSets, error: setsErr } = await supabase
    .from('sets')
    .select('id, artist_name, day, start_time')
    .eq('festival_id', festivalId)
  if (setsErr || !dbSets) {
    console.error('❌ Failed to fetch sets:', setsErr?.message)
    process.exit(1)
  }

  let socialUpdates = 0
  let bioUpdates = 0
  let unmatchedSets = 0
  let unmatchedArtists = 0
  let unattributedBios = 0

  for (const entry of file.sets) {
    const matches = dbSets.filter(
      s => s.artist_name === entry.artist_name &&
        s.day === entry.day &&
        s.start_time?.startsWith(entry.start_time),
    )
    if (matches.length !== 1) {
      console.warn(`⚠ ${matches.length === 0 ? 'No match' : 'Ambiguous match'} for "${entry.artist_name}" (${entry.day} ${entry.start_time})`)
      unmatchedSets++
      continue
    }

    // Per-member socials
    for (const member of entry.artists) {
      const sortName = member.name.toLowerCase().trim()
      const { data: artistRow } = await supabase
        .from('artists')
        .select('id, instagram_url, soundcloud_url')
        .eq('sort_name', sortName)
        .maybeSingle()

      if (!artistRow) {
        console.warn(`  ⚠ No artist row for "${member.name}" (sort_name "${sortName}")`)
        unmatchedArtists++
        continue
      }

      const update: Record<string, string> = {}
      if (member.instagram_url && !artistRow.instagram_url) update.instagram_url = member.instagram_url
      if (member.soundcloud_url && !artistRow.soundcloud_url) update.soundcloud_url = member.soundcloud_url

      if (Object.keys(update).length > 0) {
        socialUpdates++
        console.log(`  ${dryRun ? '[dry]' : '✓'} ${member.name}: ${Object.keys(update).join(', ')}`)
        if (!dryRun) {
          const { error } = await supabase.from('artists').update(update).eq('id', artistRow.id)
          if (error) console.error(`  ✕ Failed to update ${member.name}: ${error.message}`)
        }
      }
    }

    // Bio — attributed per individual member, never to a combined entity
    if (!entry.bio_raw) continue
    const memberNames = entry.artists.map(a => a.name)
    const attributed = attributeBioToMembers(entry.bio_raw, memberNames)
    if (attributed.size === 0) {
      console.warn(`  ⚠ Could not attribute bio for "${entry.artist_name}" to any listed member`)
      unattributedBios++
      continue
    }

    for (const [memberName, bioText] of attributed) {
      const sortName = memberName.toLowerCase().trim()
      const flagged = bioContainsFestivalName(bioText, festivalRootName)
      if (flagged) console.log(`  ⚠ BIO FLAG: "${memberName}" bio contains festival name "${festivalRootName}"`)

      const { data: targetArtist } = await supabase
        .from('artists')
        .select('id, bio')
        .eq('sort_name', sortName)
        .maybeSingle()

      if (!targetArtist) {
        console.warn(`  ⚠ No artist row for bio target "${sortName}"`)
        unmatchedArtists++
        continue
      }

      const shouldWrite = !targetArtist.bio || bioText.length > targetArtist.bio.length
      if (shouldWrite) {
        bioUpdates++
        console.log(`  ${dryRun ? '[dry]' : '✓'} bio → "${sortName}"`)
        if (!dryRun) {
          const { error } = await supabase
            .from('artists')
            .update({ bio: bioText, bio_festival: bioText, bio_source: bioSourceTag })
            .eq('id', targetArtist.id)
          if (error) console.error(`  ✕ Failed to update bio for ${sortName}: ${error.message}`)
        }
      }
    }
  }

  console.log('\n✅ Done!')
  console.log(`   Social field updates: ${socialUpdates}`)
  console.log(`   Bio updates: ${bioUpdates}`)
  console.log(`   Unmatched sets: ${unmatchedSets}`)
  console.log(`   Unmatched artists: ${unmatchedArtists}`)
  console.log(`   Unattributed bios: ${unattributedBios}`)
}

main().catch(err => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
