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

  // GET — list requests with user emails and matched festival names
  if (req.method === 'GET') {
    const { data: requests, error } = await supabase
      .from('festival_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return json({ error: error.message }, 500)

    // Look up emails via auth admin API
    const userIds = [...new Set(requests.map(r => r.user_id))]
    const emailMap: Record<string, string> = {}
    for (const uid of userIds) {
      const { data: { user: u } } = await supabase.auth.admin.getUserById(uid)
      if (u?.email) emailMap[uid] = u.email
    }

    // Look up matched festival names
    const festivalIds = [...new Set(requests.map(r => r.matched_festival_id).filter(Boolean))]
    const festivalMap: Record<string, string> = {}
    if (festivalIds.length > 0) {
      const { data: festivals } = await supabase.from('festivals').select('id, name').in('id', festivalIds)
      for (const f of festivals ?? []) festivalMap[f.id] = f.name
    }

    const enriched = requests.map(r => ({
      ...r,
      user_email: emailMap[r.user_id] ?? null,
      matched_festival_name: r.matched_festival_id ? festivalMap[r.matched_festival_id] ?? null : null,
    }))

    return json(enriched)
  }

  // PATCH — map request to festival
  if (req.method === 'PATCH') {
    const body = await req.json()
    const { request_id, festival_id } = body
    if (!request_id) return json({ error: 'Missing request_id' }, 400)

    const { data, error } = await supabase
      .from('festival_requests')
      .update({ matched_festival_id: festival_id || null })
      .eq('id', request_id)
      .select()
      .single()
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  return json({ error: 'Method not allowed' }, 405)
})
