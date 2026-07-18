import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error } = await supabaseUser.auth.getUser()
  if (error || !user) return null
  if (user.id !== Deno.env.get('ADMIN_UID')) return null
  return user
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const user = await verifyAdmin(req)
  if (!user) return json({ error: 'Forbidden' }, 403)

  const supabase = getServiceClient()
  const url = new URL(req.url)

  // GET — stats or list
  if (req.method === 'GET') {
    const action = url.searchParams.get('action')

    if (action === 'stats') {
      const { data: festivals } = await supabase.from('festivals').select('id')
      if (!festivals) return json([])

      const stats = await Promise.all(festivals.map(async (f) => {
        const [stages, sets, setArtists, follows] = await Promise.all([
          supabase.from('stages').select('id', { count: 'exact', head: true }).eq('festival_id', f.id),
          supabase.from('sets').select('id', { count: 'exact', head: true }).eq('festival_id', f.id),
          // Distinct parsed artists: join set_artists → artists via the festival's sets
          supabase.from('set_artists').select('artist_id, sets!inner(festival_id)').eq('sets.festival_id', f.id),
          supabase.from('festival_follows').select('id', { count: 'exact', head: true }).eq('festival_id', f.id),
        ])
        const uniqueArtists = new Set(setArtists.data?.map(sa => sa.artist_id) ?? [])
        return {
          id: f.id,
          stages_count: stages.count ?? 0,
          sets_count: sets.count ?? 0,
          artists_count: uniqueArtists.size,
          followers_count: follows.count ?? 0,
        }
      }))
      return json(stats)
    }

    // Pipeline step counters for one festival (Phase 3 — AdminPipeline page).
    // Pure read-side glue over existing tables; no state of its own.
    if (action === 'pipeline') {
      const festivalId = url.searchParams.get('festival_id')
      if (!festivalId) return json({ error: 'Missing festival_id' }, 400)

      const [sets, linkedSets, artistLinks, suggestions, follows, notified] = await Promise.all([
        supabase.from('sets').select('id', { count: 'exact', head: true }).eq('festival_id', festivalId),
        supabase.from('set_artists').select('set_id, sets!inner(festival_id)').eq('sets.festival_id', festivalId),
        supabase.from('set_artists').select('artist_id, artists!inner(enriched_at, enrichment_status), sets!inner(festival_id)').eq('sets.festival_id', festivalId),
        supabase.from('parse_suggestions').select('id', { count: 'exact', head: true }).eq('festival_id', festivalId).eq('status', 'pending'),
        supabase.from('festival_follows').select('id', { count: 'exact', head: true }).eq('festival_id', festivalId),
        supabase.from('festival_follows').select('id', { count: 'exact', head: true }).eq('festival_id', festivalId).not('notified_at', 'is', null),
      ])

      const uniqueLinkedSets = new Set((linkedSets.data ?? []).map((r: { set_id: string }) => r.set_id))
      const artistById = new Map<string, { enriched_at: string | null; enrichment_status: string }>()
      for (const r of (artistLinks.data ?? []) as unknown as { artist_id: string; artists: { enriched_at: string | null; enrichment_status: string } }[]) {
        artistById.set(r.artist_id, r.artists)
      }
      const artistRows = [...artistById.values()]

      return json({
        sets: sets.count ?? 0,
        sets_with_artists: uniqueLinkedSets.size,
        artists: artistById.size,
        artists_enriched: artistRows.filter(a => a.enriched_at !== null).length,
        artists_reviewed: artistRows.filter(a => a.enrichment_status === 'reviewed').length,
        suggestions_pending: suggestions.count ?? 0,
        followers: follows.count ?? 0,
        followers_notified: notified.count ?? 0,
      })
    }

    // Parsing-arbiter suggestions for one festival (Phase 2b — review in AdminSets)
    if (action === 'parse_suggestions') {
      const festivalId = url.searchParams.get('festival_id')
      if (!festivalId) return json({ error: 'Missing festival_id' }, 400)
      const { data, error } = await supabase
        .from('parse_suggestions')
        .select('*')
        .eq('festival_id', festivalId)
        .order('created_at', { ascending: true })
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    return json({ error: 'Unknown action' }, 400)
  }

  // PUT — update festival fields
  if (req.method === 'PUT') {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return json({ error: 'Missing id' }, 400)

    const allowed = ['name', 'slug', 'location', 'start_date', 'end_date', 'timetable_announced', 'published']
    const filtered: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key]
    }

    const { data, error } = await supabase
      .from('festivals')
      .update(filtered)
      .eq('id', id)
      .select()
      .single()
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  // PATCH — toggle a single field (published, timetable_announced)
  if (req.method === 'PATCH') {
    const body = await req.json()
    const { id, ...fields } = body
    if (!id) return json({ error: 'Missing id' }, 400)

    const allowed = ['published', 'timetable_announced']
    const filtered: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in fields) filtered[key] = fields[key]
    }

    const { data, error } = await supabase
      .from('festivals')
      .update(filtered)
      .eq('id', id)
      .select()
      .single()
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  // POST — actions (update_stage)
  if (req.method === 'POST') {
    const body = await req.json()
    const action = body.action

    if (action === 'update_stage') {
      const { stage_id, name } = body
      if (!stage_id || !name) return json({ error: 'Missing stage_id or name' }, 400)

      // stage_id is a UUID FK on sets, so renaming a stage never breaks existing links
      const { data, error } = await supabase
        .from('stages')
        .update({ name })
        .eq('id', stage_id)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') return json({ error: 'A stage with this name already exists for this festival' }, 409)
        return json({ error: error.message }, 500)
      }
      return json(data)
    }

    if (action === 'update_set') {
      const { set_id } = body
      if (!set_id) return json({ error: 'Missing set_id' }, 400)

      // Only the schedule fields are editable here (last-minute organiser changes)
      const allowed = ['stage_id', 'start_time', 'end_time', 'day']
      const filtered: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in body) filtered[key] = body[key]
      }
      if (Object.keys(filtered).length === 0) return json({ error: 'No editable fields provided' }, 400)

      const { data, error } = await supabase
        .from('sets')
        .update(filtered)
        .eq('id', set_id)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    // Accept/dismiss a parsing-arbiter suggestion (status flip only — the
    // accepted parse is applied by the next `parse-artists --arbiter` run)
    if (action === 'review_suggestion') {
      const { suggestion_id, status } = body
      if (!suggestion_id) return json({ error: 'Missing suggestion_id' }, 400)
      if (status !== 'accepted' && status !== 'dismissed' && status !== 'pending') {
        return json({ error: 'status must be accepted, dismissed, or pending' }, 400)
      }

      const { data, error } = await supabase
        .from('parse_suggestions')
        .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
        .eq('id', suggestion_id)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    return json({ error: 'Unknown action' }, 400)
  }

  return json({ error: 'Method not allowed' }, 405)
})
