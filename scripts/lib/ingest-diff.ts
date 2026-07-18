import { parseArtistName } from './artist-parser.js'
import type { ScrapedData, ScrapedSet } from '../scrapers/types.js'

// ── Types ───────────────────────────────────────────────────────────────────

export type DbState = {
  festival: { id: string; name: string; slug: string; location: string | null; start_date: string; end_date: string; timetable_announced: boolean } | null
  stages: Array<{ id: string; festival_id: string; name: string; sort_order: number }>
  sets: Array<{ id: string; festival_id: string; stage_id: string | null; artist_name: string; day: string; start_time: string | null; end_time: string | null; is_live: boolean }>
  artists: Array<{ id: string; name: string; sort_name: string; bio: string | null; source_url: string | null }>
}

export type DiffEntry = {
  type: 'added' | 'removed' | 'changed' | 'rescheduled'
  category: string
  label: string
  details?: string
}

export type ExistingSetInfo = {
  artist_name: string
  day: string
  stage_name: string | null
  start_time: string | null
  end_time: string | null
  is_live: boolean
}

export type SetDiff = {
  added: ScrapedSet[]
  removed: ExistingSetInfo[]
  updated: Array<{ scraped: ScrapedSet; existing: ExistingSetInfo; changes: string[] }>
  rescheduled: Array<{ scraped: ScrapedSet; existing: ExistingSetInfo }>
  unchanged: ScrapedSet[]
}

export type DiffResult = {
  entries: DiffEntry[]
  setDiff: SetDiff
}

export type Flag = {
  level: 'reschedule' | 'removal' | 'warn' | 'info'
  message: string
}

// ── Festival name extraction ────────────────────────────────────────────────

export function extractFestivalRootName(festivalName: string): string {
  return festivalName
    .replace(/\b20\d{2}\b/g, '')
    .replace(/\b(festival|edition|presents?|weekend|week)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ')
    .trim()
}

export function bioContainsFestivalName(bio: string, festivalRootName: string): boolean {
  if (!festivalRootName) return false
  return bio.toLowerCase().includes(festivalRootName.toLowerCase())
}

// ── Pure functions ──────────────────────────────────────────────────────────

export function normalizeTime(t: string | null): string | null {
  if (!t) return null
  return t.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1')
}

export function normalizeText(t: string): string {
  return t.normalize('NFC').replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D]/g, '"')
}

export function setKey(artistName: string, day: string, stage: string | null): string {
  return `${normalizeText(artistName)}|${day}|${stage ?? ''}`
}

export function escSql(s: string): string {
  return s.replace(/'/g, "''")
}

export function stageWhereFragment(stageName: string | null): string {
  return stageName
    ? `stage_id = (stage_ids->>'${escSql(stageName)}')::uuid`
    : 'stage_id IS NULL'
}

export function existingSetWhere(e: ExistingSetInfo): string {
  return `festival_id = fest_id AND artist_name = '${escSql(e.artist_name)}' AND day = '${e.day}' AND ${stageWhereFragment(e.stage_name)}`
}

// ── computeDiff ─────────────────────────────────────────────────────────────

export function computeDiff(scraped: ScrapedData, current: DbState): DiffResult {
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

// ── computeFlags ────────────────────────────────────────────────────────────

export function computeFlags(scraped: ScrapedData, setDiff: SetDiff): Flag[] {
  const flags: Flag[] = []

  // Scraper-reported extraction-quality warnings (e.g. poster columns on
  // vision-fallback times) — the diff preview is the review gate, so these
  // must reach it, not just the scrape logs.
  for (const w of scraped.extraction_warnings ?? []) {
    flags.push({ level: 'warn', message: w })
  }

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

  for (const r of setDiff.removed) {
    const loc = [r.stage_name, r.day, r.start_time].filter(Boolean).join(' ')
    flags.push({
      level: 'removal',
      message: `${r.artist_name} (${loc}) — will delete user_plans`,
    })
  }

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

  const noBio = scraped.artists.filter(a => !a.bio)
  if (noBio.length > 0 && scraped.artists.length > 0) {
    const withBio = scraped.artists.filter(a => a.bio).length
    flags.push({
      level: 'info',
      message: `${withBio}/${scraped.artists.length} artists have bios; ${noBio.length} artist pages had no bio text`,
    })
  }

  if (scraped.festival.timetable_announced) {
    const noTimes = scraped.sets.filter(s => !s.start_time)
    if (noTimes.length > 0) {
      flags.push({
        level: 'warn',
        message: `Festival marked as timetable_announced but ${noTimes.length} sets have no start_time`,
      })
    }
  }

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

// ── generateSql ─────────────────────────────────────────────────────────────

export function generateSql(scraped: ScrapedData, setDiff: SetDiff): string {
  const lines: string[] = []
  const slug = scraped.festival.slug
  const f = scraped.festival

  lines.push(`-- Auto-generated by ingest.ts on ${new Date().toISOString().split('T')[0]}`)
  lines.push(`-- Source: ${f.website_url}`)
  lines.push(`-- Festival: ${f.name}`)
  lines.push('')

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

  lines.push('  -- Clear set_artists (re-inserted below; no user-facing data)')
  lines.push(`  DELETE FROM set_artists WHERE set_id IN (SELECT id FROM sets WHERE festival_id = fest_id);`)
  lines.push('')

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

  if (setDiff.removed.length > 0) {
    lines.push(`  -- Removed sets (${setDiff.removed.length} — cascades user_plans/ratings)`)
    for (const e of setDiff.removed) {
      lines.push(`  DELETE FROM sets WHERE ${existingSetWhere(e)};`)
      lines.push('')
    }
  }

  lines.push('  -- Artists (parsed from set artist_name strings)')
  const processedArtists = new Set<string>()
  const scrapedBios = new Map(
    scraped.artists.map(a => [a.name.toLowerCase(), a])
  )

  // Extract root festival brand name for bio flagging
  const festivalRootName = extractFestivalRootName(f.name)

  function emitArtistUpsert(name: string, sortName: string, isCollective: boolean, bio: string | null, sourceUrl: string | null, comment?: string) {
    const flagged = bio && bioContainsFestivalName(bio, festivalRootName)
    if (flagged) {
      lines.push(`  -- ⚠ BIO FLAG: contains festival name '${escSql(festivalRootName)}'`)
    }
    if (comment) lines.push(`  -- ${comment}`)
    const bioSource = bio ? `festival:${slug}` : null
    const cols = ['name', 'sort_name', 'is_collective']
    const vals = [`'${escSql(name)}'`, `'${escSql(sortName)}'`, String(isCollective)]
    if (bio) { cols.push('bio'); vals.push(`'${escSql(bio)}'`) }
    if (sourceUrl) { cols.push('source_url'); vals.push(`'${escSql(sourceUrl)}'`) }
    if (bioSource) { cols.push('bio_source'); vals.push(`'${escSql(bioSource)}'`) }
    if (bio) { cols.push('bio_festival'); vals.push(`'${escSql(bio)}'`) }
    lines.push(`  INSERT INTO artists (${cols.join(', ')})`)
    lines.push(`  VALUES (${vals.join(', ')})`)
    lines.push(`  ON CONFLICT (sort_name) DO UPDATE SET`)
    lines.push(`    bio = CASE WHEN EXCLUDED.bio IS NOT NULL AND (artists.bio IS NULL OR length(EXCLUDED.bio) > length(artists.bio)) THEN EXCLUDED.bio ELSE artists.bio END,`)
    lines.push(`    bio_source = CASE WHEN EXCLUDED.bio IS NOT NULL AND (artists.bio IS NULL OR length(EXCLUDED.bio) > length(artists.bio)) THEN EXCLUDED.bio_source ELSE artists.bio_source END,`)
    lines.push(`    bio_festival = CASE WHEN EXCLUDED.bio_festival IS NOT NULL AND (artists.bio IS NULL OR length(EXCLUDED.bio) > length(artists.bio)) THEN EXCLUDED.bio_festival ELSE artists.bio_festival END,`)
    lines.push(`    source_url = COALESCE(EXCLUDED.source_url, artists.source_url);`)
    lines.push('')
  }

  for (const set of scraped.sets) {
    const parsed = parseArtistName(set.artist_name)

    if (parsed.collective) {
      const sortName = parsed.collective.toLowerCase().trim()
      if (!processedArtists.has(sortName)) {
        processedArtists.add(sortName)
        const scraperArtist = scrapedBios.get(sortName)
        emitArtistUpsert(parsed.collective, sortName, true, scraperArtist?.bio ?? null, scraperArtist?.source_url ?? null)
      }
    }

    for (const member of parsed.members) {
      const sortName = member.toLowerCase().trim()
      if (!sortName || processedArtists.has(sortName)) continue
      processedArtists.add(sortName)
      const scraperArtist = scrapedBios.get(sortName)
      emitArtistUpsert(member, sortName, false, scraperArtist?.bio ?? null, scraperArtist?.source_url ?? null)
    }

    if (!parsed.collective && parsed.members.length > 1) {
      const comboSortName = set.artist_name.toLowerCase().trim()
      const scraperArtist = scrapedBios.get(comboSortName)
      if (scraperArtist?.bio) {
        for (const member of parsed.members) {
          const memberSortName = member.toLowerCase().trim()
          const memberBio = scrapedBios.get(memberSortName)
          if (!memberBio?.bio) {
            lines.push(`  -- Combo bio distributed from "${escSql(set.artist_name)}"`)
            lines.push(`  UPDATE artists SET`)
            lines.push(`    bio_festival = CASE WHEN bio_festival IS NULL THEN '${escSql(scraperArtist.bio)}' ELSE bio_festival END,`)
            lines.push(`    bio_source = CASE WHEN bio_festival IS NULL THEN 'festival:${slug}' ELSE bio_source END`)
            lines.push(`  WHERE sort_name = '${escSql(memberSortName)}';`)
            lines.push('')
          }
        }
      }
    }
  }

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
