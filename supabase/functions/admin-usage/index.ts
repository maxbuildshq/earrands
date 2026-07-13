import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

// GET — api_usage rows for the current month (admin API-budgets panel)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const user = await verifyAdmin(req)
  if (!user) return json({ error: 'Forbidden' }, 403)

  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const monthStart = new Date()
  monthStart.setUTCDate(1)

  const { data, error } = await supabase
    .from('api_usage')
    .select('vendor, day, count')
    .gte('day', monthStart.toISOString().slice(0, 10))
    .order('day')

  if (error) return json({ error: error.message }, 500)
  return json({ data })
})
