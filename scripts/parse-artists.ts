#!/usr/bin/env node
/**
 * parse-artists.ts
 *
 * Parses artist_name strings from the `sets` table and populates
 * the `artists` and `set_artists` tables. Safe to re-run — existing
 * records are skipped via ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   npm run parse-artists                               # all festivals
 *   npm run parse-artists -- --festival=verknipt-2026  # one festival
 *   npm run parse-artists -- --dry-run                 # preview, no writes
 *   npm run parse-artists -- --festival=<slug> --arbiter
 *       # also run the parsing arbiter: detect novel/unclean parses, get LLM
 *       # suggestions (local claude CLI), persist as pending for admin review;
 *       # previously accepted suggestions override the rule parse
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (service role bypasses RLS).
 * Get it from: Supabase dashboard → Project Settings → API → service_role → Reveal
 */
import { createClient } from '@supabase/supabase-js'
import { parseArtistName, type ParseResult, type Role } from './lib/artist-parser.js'
import { detectBatch } from './lib/parse-detector.js'
import { runArbiter } from './lib/arbiter.js'

export { parseArtistName }

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const festivalSlug = args.find(a => a.startsWith('--festival='))?.split('=')[1]
const dryRun = args.includes('--dry-run')
const arbiter = args.includes('--arbiter')

if (arbiter && !festivalSlug) {
  console.error('❌ --arbiter requires --festival=<slug> (suggestions are festival-scoped)')
  process.exit(1)
}

console.log('🎵 earrands — Artist Parser')
console.log('──────────────────────────────────')
if (dryRun) console.log('🔍 DRY RUN — no DB changes will be made')
console.log(festivalSlug ? `🎪 Festival: ${festivalSlug}` : '🎪 Processing all festivals')
console.log()

// ── Supabase admin client (bypasses RLS) ─────────────────────────────────────

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('❌ Missing env vars.')
  console.error('   Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local')
  console.error('   Get the service role key from: Supabase dashboard → Project Settings → API')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve festival slug → id if needed
  let festivalId: string | null = null
  if (festivalSlug) {
    const { data: festival, error } = await supabase
      .from('festivals')
      .select('id')
      .eq('slug', festivalSlug)
      .single()

    if (error || !festival) {
      console.error(`❌ Festival not found: "${festivalSlug}"`)
      console.error('   Check the slug in the festivals table.')
      process.exit(1)
    }
    festivalId = festival.id
  }

  // Fetch sets
  const setsQuery = supabase.from('sets').select('id, artist_name')
  const { data: sets, error: setsError } = await (
    festivalId ? setsQuery.eq('festival_id', festivalId) : setsQuery
  )

  if (setsError || !sets) {
    console.error('❌ Failed to fetch sets:', setsError?.message)
    process.exit(1)
  }

  console.log(`📋 ${sets.length} sets to process`)

  // ── Arbiter: accepted suggestions override the rule parse ──────────────────
  const overrides = new Map<string, ParseResult>()
  if (arbiter) {
    const { data: accepted } = await supabase
      .from('parse_suggestions')
      .select('raw_name, suggested')
      .eq('festival_id', festivalId!)
      .eq('status', 'accepted')
    for (const row of accepted ?? []) {
      const s = row.suggested as { collective: string | null; members: string[] }
      overrides.set(row.raw_name, {
        collective: s.collective,
        members: s.members,
        role: s.collective ? 'member' : s.members.length > 1 ? 'collab' : 'solo',
      })
    }
    if (overrides.size > 0) console.log(`🧑‍⚖️ ${overrides.size} accepted arbiter override(s) in effect`)
  }

  // Parse all sets → collect unique artists + links
  type ArtistEntry = { name: string; sort_name: string; is_collective: boolean }
  type LinkEntry = { set_id: string; sort_name: string; role: Role; billing_order: number }

  const artistsMap = new Map<string, ArtistEntry>()
  const links: LinkEntry[] = []

  for (const set of sets) {
    const { collective, members, role } = overrides.get(set.artist_name) ?? parseArtistName(set.artist_name)

    if (collective) {
      const sortName = collective.toLowerCase().trim()
      if (!artistsMap.has(sortName)) {
        artistsMap.set(sortName, { name: collective, sort_name: sortName, is_collective: true })
      }
      links.push({ set_id: set.id, sort_name: sortName, role: 'collab', billing_order: 0 })
    }

    members.forEach((member, i) => {
      const sortName = member.toLowerCase().trim()
      if (sortName === '') return
      if (!artistsMap.has(sortName)) {
        artistsMap.set(sortName, { name: member, sort_name: sortName, is_collective: false })
      }
      links.push({ set_id: set.id, sort_name: sortName, role, billing_order: i + 1 })
    })
  }

  const uniqueArtists = [...artistsMap.values()]

  console.log(`🎤 ${uniqueArtists.length} unique artists identified`)
  console.log(`🔗 ${links.length} set→artist links to write`)

  // Show collectives
  const collectives = uniqueArtists.filter(a => a.is_collective)
  if (collectives.length > 0) {
    console.log(`\n   Collectives: ${collectives.map(c => c.name).join(', ')}`)
  }

  console.log('\n📊 Multi-artist sets:')
  sets.forEach(set => {
    const result = parseArtistName(set.artist_name)
    if (result.role !== 'solo' || result.collective) {
      const parts = result.collective ? [`[${result.collective}]`, ...result.members] : result.members
      console.log(`   "${set.artist_name}" → ${parts.join(` ‹${result.role}› `)}`)
    }
  })

  // ── Arbiter: detect novel/unclean parses → LLM suggestions for review ──────
  if (arbiter) {
    const uniqueRaws = [...new Set(sets.map(s => s.artist_name))]
      .filter(raw => !overrides.has(raw))
    const { data: knownRows } = await supabase.from('artists').select('sort_name')
    const known = new Set((knownRows ?? []).map(r => r.sort_name as string))
    // Structural signals only: on a fresh festival every artist is "unknown",
    // so unknown-membership alone would flag the entire lineup.
    const flagged = detectBatch(
      uniqueRaws.map(raw => ({ raw, parsed: parseArtistName(raw) })),
      known,
      { unknownAlone: false },
    )

    // Don't re-arbitrate names that already have a suggestion (any status —
    // a dismissed suggestion stays dismissed).
    const { data: existing } = await supabase
      .from('parse_suggestions')
      .select('raw_name')
      .eq('festival_id', festivalId!)
    const seen = new Set((existing ?? []).map(r => r.raw_name as string))
    const fresh = flagged.filter(f => !seen.has(f.raw))

    console.log(`\n🧑‍⚖️ Arbiter: ${flagged.length} suspicious parse(s), ${fresh.length} new`)
    for (const f of fresh) console.log(`   "${f.raw}" — ${f.reasons.join('; ')}`)

    if (fresh.length > 0 && !dryRun) {
      const { data: artistNames } = await supabase.from('artists').select('name').order('sort_name')
      const suggestions = runArbiter(fresh, (artistNames ?? []).map(r => r.name as string))
      const byRaw = new Map(fresh.map(f => [f.raw, f]))
      const rows = suggestions.map(s => ({
        festival_id: festivalId!,
        raw_name: s.raw,
        current_parse: byRaw.get(s.raw)!.parsed,
        suggested: { collective: s.collective, members: s.members },
        confidence: s.confidence,
        reason: s.reason,
        detector_reasons: byRaw.get(s.raw)!.reasons,
      }))
      const { error: sugError } = await supabase
        .from('parse_suggestions')
        .upsert(rows, { onConflict: 'festival_id,raw_name', ignoreDuplicates: true })
      if (sugError) console.error(`   ❌ failed to write suggestions: ${sugError.message}`)
      else console.log(`   💾 ${rows.length} suggestion(s) written for admin review`)
    } else if (fresh.length > 0) {
      console.log('   (dry run — no LLM call, no suggestions written)')
    }
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete — run without --dry-run to write to DB')
    return
  }

  // ── Upsert artists ──────────────────────────────────────────────────────────
  const { error: artistError } = await supabase
    .from('artists')
    .upsert(uniqueArtists, { onConflict: 'sort_name', ignoreDuplicates: true })

  if (artistError) {
    console.error('❌ Failed to upsert artists:', artistError.message)
    process.exit(1)
  }

  // Fetch back to get UUIDs (upsert with ignoreDuplicates doesn't return existing rows)
  const { data: artistRows, error: fetchError } = await supabase
    .from('artists')
    .select('id, sort_name')
    .in('sort_name', uniqueArtists.map(a => a.sort_name))

  if (fetchError || !artistRows) {
    console.error('❌ Failed to fetch artist IDs:', fetchError?.message)
    process.exit(1)
  }

  const artistIdMap = new Map(artistRows.map(a => [a.sort_name, a.id as string]))

  // ── Upsert set_artists ──────────────────────────────────────────────────────
  const setArtistRows = links
    .map(link => ({
      set_id: link.set_id,
      artist_id: artistIdMap.get(link.sort_name),
      role: link.role,
      billing_order: link.billing_order,
    }))
    .filter(
      (row): row is { set_id: string; artist_id: string; role: Role; billing_order: number } =>
        row.artist_id !== undefined,
    )

  const { error: linkError } = await supabase
    .from('set_artists')
    .upsert(setArtistRows, { onConflict: 'set_id,artist_id', ignoreDuplicates: true })

  if (linkError) {
    console.error('❌ Failed to upsert set_artists:', linkError.message)
    process.exit(1)
  }

  console.log('\n✅ Done!')
  console.log(`   Artists in DB (total): ${artistRows.length}`)
  console.log(`   Set→artist links written: ${setArtistRows.length}`)
  console.log()
  console.log('💡 Verify in Supabase SQL Editor:')
  console.log('   SELECT a.name, count(*) sets FROM artists a')
  console.log('   JOIN set_artists sa ON sa.artist_id = a.id')
  console.log('   GROUP BY a.name HAVING count(*) > 1 ORDER BY sets DESC;')
}

main().catch(err => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
