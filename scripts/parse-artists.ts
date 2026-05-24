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
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (service role bypasses RLS).
 * Get it from: Supabase dashboard → Project Settings → API → service_role → Reveal
 */
import { createClient } from '@supabase/supabase-js'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const festivalSlug = args.find(a => a.startsWith('--festival='))?.split('=')[1]
const dryRun = args.includes('--dry-run')

console.log('🎵 Festival Pulse — Artist Parser')
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

// ── Artist name parser ────────────────────────────────────────────────────────

type Role = 'solo' | 'b2b' | 'f2f' | 'collab' | 'vs' | 'member'

type ParseResult = {
  collective: string | null  // e.g. "Collabs 3000", "LSD"
  members: string[]          // individual artist names
  role: Role
}

/**
 * Split a raw artist_name string into individual artists.
 *
 * Patterns detected (in priority order):
 *  1. Colon format       "LSD: Luke Slater, Steve Bicknell and Function"  → member
 *  2. Parenthetical      "Collabs 3000 (Chris Liebing & Speedy J)"         → member
 *  3. F2F                "DJ IP F2F Dr. G"                                 → f2f
 *  4. B2B                "SLVL B2B USH"                                    → b2b
 *  5. vs                 "Shed vs Head High"                               → vs
 *  6. x (space-x-space)  "Fjaak x KiNK"  (won't match "DAX J")            → collab
 *  7. &                  "Alarico & Ben Klock"                             → collab
 *  8. Solo               "Adam Beyer"                                      → solo
 */
export function parseArtistName(raw: string): ParseResult {
  let name = raw.trim()

  // Strip "(live)" suffix — performance type is already on sets.is_live
  name = name.replace(/\s*\(live\)$/i, '').trim()

  // 1. Colon format: collective name before colon, members after
  const colonIdx = name.indexOf(':')
  if (colonIdx > 0 && colonIdx <= name.length / 2) {
    const collective = name.slice(0, colonIdx).trim()
    const remainder = name.slice(colonIdx + 1).trim()
    const members = remainder
      .replace(/ and /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective, members, role: 'member' }
  }

  // 2. Parenthetical with , or & = member list
  const parenMatch = name.match(/^(.+?)\s*\((.+)\)$/)
  if (parenMatch && /[,&]/.test(parenMatch[2])) {
    const collective = parenMatch[1].trim()
    const members = parenMatch[2]
      .replace(/ & /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective, members, role: 'member' }
  }

  // 3. F2F — case-insensitive
  if (/ f2f /i.test(name)) {
    const members = name.split(/ f2f /i).map(s => s.trim())
    return { collective: null, members, role: 'f2f' }
  }

  // 4. B2B — case-insensitive
  if (/ b2b /i.test(name)) {
    const members = name.split(/ b2b /i).map(s => s.trim())
    return { collective: null, members, role: 'b2b' }
  }

  // 5. "vs" — exact (lowercase only)
  if (name.includes(' vs ')) {
    const members = name.split(' vs ').map(s => s.trim())
    return { collective: null, members, role: 'vs' }
  }

  // 6. " x " — case-sensitive space-x-space (won't match "DAX J" or "Toxic Machinery")
  if (name.includes(' x ')) {
    const members = name.split(' x ').map(s => s.trim())
    return { collective: null, members, role: 'collab' }
  }

  // 7. " & "
  if (name.includes(' & ')) {
    const members = name.split(' & ').map(s => s.trim())
    return { collective: null, members, role: 'collab' }
  }

  // 8. Solo
  return { collective: null, members: [name], role: 'solo' }
}

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

  // Parse all sets → collect unique artists + links
  type ArtistEntry = { name: string; sort_name: string; is_collective: boolean }
  type LinkEntry = { set_id: string; sort_name: string; role: Role; billing_order: number }

  const artistsMap = new Map<string, ArtistEntry>()
  const links: LinkEntry[] = []

  for (const set of sets) {
    const { collective, members, role } = parseArtistName(set.artist_name)

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

  if (dryRun) {
    console.log('\n📊 Dry-run sample (first 10 sets):')
    sets.slice(0, 10).forEach(set => {
      const result = parseArtistName(set.artist_name)
      if (result.role !== 'solo' || result.collective) {
        const parts = result.collective ? [`[${result.collective}]`, ...result.members] : result.members
        console.log(`   "${set.artist_name}" → ${parts.join(` ‹${result.role}› `)}`)
      }
    })
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
