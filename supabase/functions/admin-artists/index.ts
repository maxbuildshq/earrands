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
    if (typeof u.followers_count === 'number') result.followers_count = u.followers_count

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

const DISCOGS_API = 'https://api.discogs.com'

// Fetch up to 5 image URLs for a Discogs artist id (primary first), mirroring the
// enrichment pipeline's ordering. Returns null when creds are unset or the request
// fails — the caller then leaves the carousel untouched.
async function fetchDiscogsImages(discogsId: number): Promise<string[] | null> {
  const key = Deno.env.get('DISCOGS_CONSUMER_KEY')
  const secret = Deno.env.get('DISCOGS_CONSUMER_SECRET')
  if (!key || !secret) return null
  try {
    const res = await fetch(`${DISCOGS_API}/artists/${discogsId}`, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'earrands/1.0',
      },
    })
    if (!res.ok) return null
    const data = await res.json() as { images?: Array<{ type: string; uri: string }> }
    const images = data.images ?? []
    const ordered = [...images.filter(i => i.type === 'primary'), ...images.filter(i => i.type !== 'primary')]
    return ordered.map(i => i.uri).filter(Boolean).slice(0, 5)
  } catch {
    return null
  }
}

// Image-candidate carousel entries (see EnrichmentResult.image_candidates). The
// edge function can't run DETR scoring, so refetched candidates are unscored —
// admin can re-run enrichment image scoring if a proper ranking is needed.
type Candidate = {
  url: string
  source: string
  score: number
  person_detected: boolean
  person_count: number
  person_bbox_ratio: number | null
  confidence?: string
}

function makeCandidate(url: string, source: string, confidence?: string): Candidate {
  return { url, source, score: 0, person_detected: false, person_count: 0, person_bbox_ratio: null, ...(confidence ? { confidence } : {}) }
}

// Point the SoundCloud-avatar candidate at the freshly-scraped URL (or prepend it),
// so the carousel thumbnail matches the newly-selected winner image.
function upsertSoundcloudCandidate(candidates: Candidate[], url: string): Candidate[] {
  if (candidates.some(c => c.source === 'soundcloud-image')) {
    return candidates.map(c => (c.source === 'soundcloud-image' ? { ...c, url } : c))
  }
  return [makeCandidate(url, 'soundcloud-image'), ...candidates]
}

// Replace every Discogs candidate with the freshly-fetched image set, preserving
// the prior Discogs confidence tag (identity doesn't change on an image refetch).
function replaceDiscogsCandidates(candidates: Candidate[], images: string[]): Candidate[] {
  const priorConfidence = candidates.find(c => c.source.startsWith('discogs-image'))?.confidence
  const nonDiscogs = candidates.filter(c => !c.source.startsWith('discogs-image'))
  const fresh = images.map((url, i) => makeCandidate(url, i === 0 ? 'discogs-image' : `discogs-image-${i + 1}`, priorConfidence))
  return [...nonDiscogs, ...fresh]
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
    if (url.searchParams.get('has_candidates') === '1') {
      query = query.not('image_candidates', 'is', null)
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
      'enrichment_status', 'enriched_at', 'enrichment_confidence',
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

      // Current values to diff against + the candidate carousel we may refresh
      const { data: current } = await supabase
        .from('artists')
        .select('soundcloud_url, discogs_id, image_candidates')
        .eq('id', artist_id)
        .single()

      const refetchedFields: Record<string, unknown> = {}
      let candidates: Candidate[] = Array.isArray(current?.image_candidates) ? current!.image_candidates : []
      let candidatesChanged = false

      // SoundCloud URL change → refresh profile metadata + avatar (winner) and
      // the SC candidate thumbnail in the carousel.
      const scUrlChanged = updates.soundcloud_url && updates.soundcloud_url !== current?.soundcloud_url
      // SoundCloud cleared → drop the SC-derived candidate/embed/followers so the
      // carousel and follower count don't keep showing a profile that's gone.
      const scUrlCleared = 'soundcloud_url' in updates && !updates.soundcloud_url && !!current?.soundcloud_url
      if (scUrlChanged && updates.soundcloud_url) {
        const scData = await scrapeSoundCloudProfile(updates.soundcloud_url)
        if (scData) {
          // Strip sc_description (not a real column) and map followers_count to the
          // real column, then refresh only profile metadata (image / location /
          // followers). Crucially, do NOT touch bio_source: this re-fetch does not
          // change the active `bio` text, so relabeling it 'soundcloud'
          // mis-attributed a previously-activated bio (e.g. the generated one) to
          // SoundCloud. The SC bio text is captured separately during full
          // enrichment via bio_research.
          const { sc_description: _sc, followers_count, ...rest } = scData as Record<string, unknown>
          Object.assign(refetchedFields, rest)
          if (typeof followers_count === 'number') refetchedFields.soundcloud_followers = followers_count
          if (typeof rest.image_url === 'string') {
            candidates = upsertSoundcloudCandidate(candidates, rest.image_url)
            candidatesChanged = true
          }
        }
        // Keep the embed URL in sync with the profile URL whenever it changes
        refetchedFields.soundcloud_embed_url = updates.soundcloud_url
      } else if (scUrlCleared) {
        candidates = candidates.filter(c => c.source !== 'soundcloud-image')
        candidatesChanged = true
        refetchedFields.soundcloud_embed_url = null
        refetchedFields.soundcloud_followers = null
      }

      // Discogs id change → refetch the Discogs image set into the carousel and
      // point the winner at the new primary, mirroring the SoundCloud behavior.
      const discogsIdChanged = updates.discogs_id != null && updates.discogs_id !== current?.discogs_id
      // Discogs cleared → drop the Discogs image candidates from the carousel.
      const discogsIdCleared = 'discogs_id' in updates && updates.discogs_id == null && current?.discogs_id != null
      if (discogsIdChanged) {
        const dcImages = await fetchDiscogsImages(updates.discogs_id as number)
        if (dcImages && dcImages.length > 0) {
          candidates = replaceDiscogsCandidates(candidates, dcImages)
          candidatesChanged = true
          refetchedFields.image_url = dcImages[0]
        }
      } else if (discogsIdCleared) {
        candidates = candidates.filter(c => !c.source.startsWith('discogs-image'))
        candidatesChanged = true
      }

      if (candidatesChanged) refetchedFields.image_candidates = candidates

      const merged = { ...refetchedFields, ...updates }
      const { data, error } = await supabase
        .from('artists')
        .update(merged)
        .eq('id', artist_id)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ data, refetched: Object.keys(refetchedFields) })
    }

    // Approve = human vetted the whole card (ADR 011): status → reviewed and every
    // populated field's confidence upgrades to high with an admin-approved stamp;
    // machine confidence is preserved inside the evidence trail as provenance.
    if (action === 'approve') {
      const { artist_ids } = body
      if (!artist_ids?.length) return json({ error: 'Missing artist_ids' }, 400)

      const { data: rows, error: fetchError } = await supabase
        .from('artists')
        .select('id, soundcloud_url, instagram_url, bandcamp_url, image_url, discogs_id, city, soundcloud_followers, enrichment_confidence')
        .in('id', artist_ids)
      if (fetchError) return json({ error: fetchError.message }, 500)

      const stamp = `admin-approved ${new Date().toISOString().slice(0, 10)}`
      const now = new Date().toISOString()
      const fieldPresence: Array<[string, (r: Record<string, unknown>) => boolean]> = [
        ['soundcloud', r => !!r.soundcloud_url],
        ['instagram', r => !!r.instagram_url],
        ['bandcamp', r => !!r.bandcamp_url],
        ['image', r => !!r.image_url],
        ['discogs', r => r.discogs_id != null],
        ['location', r => !!r.city],
        ['followers', r => r.soundcloud_followers != null],
      ]

      let updated = 0
      for (const row of rows ?? []) {
        const confidence: Record<string, { level: string; evidence: string[] }> =
          { ...(row.enrichment_confidence ?? {}) }
        for (const [field, present] of fieldPresence) {
          if (!present(row as Record<string, unknown>)) continue
          const prior = confidence[field]
          const provenance = prior && prior.level !== 'high'
            ? [`was ${prior.level}`, ...prior.evidence]
            : prior?.evidence ?? []
          confidence[field] = { level: 'high', evidence: [stamp, ...provenance.filter(e => !e.startsWith('admin-approved'))] }
        }
        const { error } = await supabase
          .from('artists')
          .update({ enrichment_status: 'reviewed', enriched_at: now, enrichment_confidence: confidence })
          .eq('id', row.id)
        if (!error) updated++
      }
      return json({ count: updated })
    }

    // Wipe every machine-enriched field for a junk artist (generic name, all
    // searches came back garbage) in one shot — EXCEPT the bio versions, which
    // often come from a separate reliable source. Drops image candidates too and
    // strips the cleared fields' confidence keys, keeping any bio-related ones.
    if (action === 'clean') {
      const { artist_id } = body
      if (!artist_id) return json({ error: 'Missing artist_id' }, 400)

      const { data: current } = await supabase
        .from('artists')
        .select('enrichment_confidence')
        .eq('id', artist_id)
        .single()

      const clearedKeys = ['image', 'soundcloud', 'instagram', 'bandcamp', 'discogs', 'location', 'followers']
      const confidence = { ...(current?.enrichment_confidence ?? {}) }
      for (const key of clearedKeys) delete confidence[key]

      const { data, error } = await supabase
        .from('artists')
        .update({
          image_url: null,
          image_candidates: null,
          instagram_url: null,
          soundcloud_url: null,
          soundcloud_embed_url: null,
          bandcamp_url: null,
          discogs_id: null,
          city: null,
          country_code: null,
          soundcloud_followers: null,
          enrichment_status: 'pending',
          enrichment_confidence: confidence,
        })
        .eq('id', artist_id)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ data })
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
