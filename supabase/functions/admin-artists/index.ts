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

async function scrapeSoundCloudProfile(scUrl: string) {
  try {
    const res = await fetch(scUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; earrands/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()

    const hydrationMatch = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/)
    if (!hydrationMatch) return null

    const hydration = JSON.parse(hydrationMatch[1])
    const userEntry = hydration.find((h: { hydratable: string }) => h.hydratable === 'user')
    if (!userEntry?.data) return null

    const u = userEntry.data
    const result: Record<string, unknown> = {}

    if (u.city) result.city = u.city
    if (u.country_code) result.country_code = u.country_code
    if (u.description) result.sc_description = u.description
    if (u.avatar_url) {
      result.image_url = u.avatar_url.replace('-large', '-t500x500')
    }

    const webProfiles = hydration.find((h: { hydratable: string }) => h.hydratable === 'webProfiles')
    if (webProfiles?.data) {
      for (const link of webProfiles.data) {
        const url = link.url?.toLowerCase() ?? ''
        if (url.includes('instagram.com')) {
          result.instagram_url = link.url
        } else if (url.includes('bandcamp.com')) {
          result.bandcamp_url = link.url
        }
      }
    }

    return result
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const user = await verifyAdmin(req)
  if (!user) return json({ error: 'Forbidden' }, 403)

  const supabase = getServiceClient()
  const url = new URL(req.url)

  // GET — list artists or single artist by id
  if (req.method === 'GET') {
    const artistId = url.searchParams.get('artist_id')
    if (artistId) {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .eq('id', artistId)
        .single()
      if (error) return json({ error: error.message }, 404)
      return json(data)
    }

    const festivalId = url.searchParams.get('festival_id')
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')
    const limit = parseInt(url.searchParams.get('limit') ?? '100')
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    let query = supabase.from('artists').select('*', { count: 'exact' })

    if (status && status !== 'all') {
      query = query.eq('enrichment_status', status)
    }
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    query = query.order('sort_name').range(offset, offset + limit - 1)

    // If filtering by festival, get artist IDs from set_artists first
    if (festivalId) {
      const { data: setArtists } = await supabase
        .from('set_artists')
        .select('artist_id, sets!inner(festival_id)')
        .eq('sets.festival_id', festivalId)
      const artistIds = [...new Set(setArtists?.map(sa => sa.artist_id) ?? [])]
      if (artistIds.length === 0) return json({ data: [], count: 0 })
      query = query.in('id', artistIds)
    }

    const { data, error, count } = await query
    if (error) return json({ error: error.message }, 500)
    return json({ data, count })
  }

  // PUT — update artist fields
  if (req.method === 'PUT') {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return json({ error: 'Missing id' }, 400)

    const allowed = [
      'name', 'sort_name', 'bio', 'bio_festival', 'bio_generated', 'bio_source',
      'image_url', 'instagram_url', 'soundcloud_url', 'soundcloud_embed_url',
      'bandcamp_url', 'discogs_id', 'city', 'country_code',
      'enrichment_status', 'enriched_at',
    ]
    const filtered: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key]
    }

    const { data, error } = await supabase
      .from('artists')
      .update(filtered)
      .eq('id', id)
      .select()
      .single()
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  // POST — actions (update_and_refetch, bulk_update, activate_bio)
  if (req.method === 'POST') {
    const body = await req.json()
    const action = body.action

    if (action === 'update_and_refetch') {
      const { artist_id, updates } = body
      if (!artist_id) return json({ error: 'Missing artist_id' }, 400)

      // Get current artist to detect SC URL change
      const { data: current } = await supabase
        .from('artists')
        .select('soundcloud_url')
        .eq('id', artist_id)
        .single()

      const scUrlChanged = updates.soundcloud_url &&
        updates.soundcloud_url !== current?.soundcloud_url

      let refetchedFields: Record<string, unknown> = {}
      if (scUrlChanged && updates.soundcloud_url) {
        const scData = await scrapeSoundCloudProfile(updates.soundcloud_url)
        if (scData) {
          const { sc_description, ...rest } = scData as Record<string, unknown>
          refetchedFields = rest
          // SC description goes into bio_festival or a note, not directly into bio
          if (sc_description) {
            refetchedFields.bio_source = 'soundcloud'
          }
        }
      }

      const merged = { ...refetchedFields, ...updates }
      const { data, error } = await supabase
        .from('artists')
        .update(merged)
        .eq('id', artist_id)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ data, refetched: scUrlChanged ? Object.keys(refetchedFields) : [] })
    }

    if (action === 'bulk_update') {
      const { artist_ids, updates } = body
      if (!artist_ids?.length) return json({ error: 'Missing artist_ids' }, 400)

      const allowed = ['enrichment_status', 'enriched_at']
      const filtered: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in updates) filtered[key] = updates[key]
      }

      const { data, error } = await supabase
        .from('artists')
        .update(filtered)
        .in('id', artist_ids)
        .select()
      if (error) return json({ error: error.message }, 500)
      return json({ data, count: data.length })
    }

    if (action === 'activate_bio') {
      const { artist_id, source } = body
      if (!artist_id || !source) return json({ error: 'Missing artist_id or source' }, 400)

      const { data: artist } = await supabase
        .from('artists')
        .select('bio_festival, bio_generated, source_url')
        .eq('id', artist_id)
        .single()
      if (!artist) return json({ error: 'Artist not found' }, 404)

      let newBio: string | null = null
      let resolvedSource = source
      if (source === 'festival' || source.startsWith('festival:')) {
        newBio = artist.bio_festival
        // Derive festival slug from source_url for proper provenance
        if (artist.source_url) {
          if (artist.source_url.includes('awakenings.com')) resolvedSource = 'festival:awakenings'
          else if (artist.source_url.includes('dekmantel')) resolvedSource = 'festival:dekmantel'
          else if (artist.source_url.includes('verknipt')) resolvedSource = 'festival:verknipt'
          else if (artist.source_url.includes('909festival')) resolvedSource = 'festival:909'
          else resolvedSource = 'festival'
        }
      } else if (source === 'generated') {
        newBio = artist.bio_generated
      }
      if (newBio === null && source !== 'manual') {
        return json({ error: `No ${source} bio available` }, 400)
      }

      const { data, error } = await supabase
        .from('artists')
        .update({ bio: newBio, bio_source: resolvedSource })
        .eq('id', artist_id)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    return json({ error: 'Unknown action' }, 400)
  }

  return json({ error: 'Method not allowed' }, 405)
})
