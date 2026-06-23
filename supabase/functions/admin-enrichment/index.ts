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

  // GET — list jobs
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  // POST — create job
  if (req.method === 'POST') {
    const body = await req.json()
    const { type, festival_slug, artist_sort_names, fields, search_keywords } = body

    const { data, error } = await supabase
      .from('enrichment_jobs')
      .insert({
        type: type ?? 'enrich',
        festival_slug: festival_slug ?? null,
        artist_sort_names: artist_sort_names ?? null,
        fields: fields ?? null,
        search_keywords: search_keywords || null,
      })
      .select()
      .single()
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  // PATCH — cancel or retry
  if (req.method === 'PATCH') {
    const body = await req.json()
    const { id, action } = body
    if (!id || !action) return json({ error: 'Missing id or action' }, 400)

    if (action === 'cancel') {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .update({ status: 'failed', error: 'Cancelled by admin' })
        .eq('id', id)
        .in('status', ['pending', 'running'])
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    if (action === 'retry') {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .update({ status: 'pending', started_at: null, completed_at: null, error: null, result_summary: null })
        .eq('id', id)
        .eq('status', 'failed')
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    // Mark a running job as completed (data already in DB, process died before updating status)
    if (action === 'mark_done') {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), result_summary: { message: 'Marked done by admin' } })
        .eq('id', id)
        .eq('status', 'running')
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    return json({ error: 'Unknown action' }, 400)
  }

  // DELETE — remove a job row
  if (req.method === 'DELETE') {
    const body = await req.json()
    const { id } = body
    if (!id) return json({ error: 'Missing id' }, 400)
    const { error } = await supabase.from('enrichment_jobs').delete().eq('id', id)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed' }, 405)
})
