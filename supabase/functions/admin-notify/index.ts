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

// Email template functions (ported from scripts/lib/notify-helpers.ts)
type EmailType = 'follow' | 'request'

function buildSubject(festivalName: string, type: EmailType): string {
  return type === 'follow'
    ? `The ${festivalName} timetable is live`
    : `${festivalName} is now on earrands`
}

function buildEmailHtml(festivalName: string, scheduleUrl: string, type: EmailType): string {
  const headline = type === 'follow'
    ? `The <strong>${festivalName}</strong> timetable is live.`
    : `<strong>${festivalName}</strong> — the festival you requested — is now on earrands.`
  const subline = type === 'follow'
    ? 'You asked us to let you know — here it is.'
    : 'You asked for it, we added it.'
  const unsubNote = type === 'follow'
    ? `You're getting this because you followed ${festivalName} on earrands.`
    : `You're getting this because you requested ${festivalName} on earrands.`

  return `<div style="font-family:'Space Mono',monospace;background:#0A0A0A;color:#E5E5E5;padding:24px;">
  <p style="color:#CCFF00;font-weight:bold;font-size:18px;margin:0 0 16px;letter-spacing:1px;">EARRANDS</p>
  <p style="margin:0 0 8px;">${headline}</p>
  <p style="margin:0 0 24px;color:#FFFFFF;">${subline}</p>
  <a href="${scheduleUrl}" style="display:inline-block;background:#CCFF00;color:#0A0A0A;font-weight:bold;text-decoration:none;padding:12px 20px;text-transform:uppercase;letter-spacing:1px;">View the timetable</a>
  <p style="margin:24px 0 0;font-size:12px;color:#888;">${unsubNote}</p>
</div>`
}

function buildEmailText(festivalName: string, scheduleUrl: string, type: EmailType): string {
  const subline = type === 'follow'
    ? 'You asked us to let you know — here it is.'
    : 'You asked for it, we added it.'
  const unsubNote = type === 'follow'
    ? `You're getting this because you followed ${festivalName} on earrands.`
    : `You're getting this because you requested ${festivalName} on earrands.`
  return `${festivalName} — ${subline}\n\n${scheduleUrl}\n\n${unsubNote}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const user = await verifyAdmin(req)
  if (!user) return json({ error: 'Forbidden' }, 403)

  const supabase = getServiceClient()

  if (req.method === 'GET') {
    // Return notification log
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100)
    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { type, festival_id, festival_slug, request_ids, dry_run } = body

    if (!festival_id || !type) return json({ error: 'Missing festival_id or type' }, 400)

    const { data: festival } = await supabase
      .from('festivals')
      .select('name, slug')
      .eq('id', festival_id)
      .single()
    if (!festival) return json({ error: 'Festival not found' }, 404)

    const baseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://earrands.app/app'
    const scheduleUrl = `${baseUrl}/festivals/${festival_slug ?? festival.slug}/schedule`

    const subject = buildSubject(festival.name, type)
    const html = buildEmailHtml(festival.name, scheduleUrl, type)
    const text = buildEmailText(festival.name, scheduleUrl, type)

    // Collect recipients
    let recipients: { email: string; userId: string; rowId: string }[] = []

    if (type === 'follow') {
      const { data: follows } = await supabase
        .from('festival_follows')
        .select('id, user_id')
        .eq('festival_id', festival_id)
        .is('notified_at', null)
      if (!follows?.length) return json({ message: 'No unnotified followers', recipients: 0 })

      for (const f of follows) {
        const { data: { user: u } } = await supabase.auth.admin.getUserById(f.user_id)
        if (u?.email) recipients.push({ email: u.email, userId: f.user_id, rowId: f.id })
      }
    } else if (type === 'request') {
      if (!request_ids?.length) return json({ error: 'Missing request_ids' }, 400)
      const { data: requests } = await supabase
        .from('festival_requests')
        .select('id, user_id')
        .in('id', request_ids)
        .is('notified_at', null)
      if (!requests?.length) return json({ message: 'No unnotified requests', recipients: 0 })

      for (const r of requests) {
        const { data: { user: u } } = await supabase.auth.admin.getUserById(r.user_id)
        if (u?.email) recipients.push({ email: u.email, userId: r.user_id, rowId: r.id })
      }
    }

    if (dry_run) {
      return json({ dry_run: true, recipients: recipients.length, emails: recipients.map(r => r.email), subject, html })
    }

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'earrands <noreply@earrands.app>'
    if (!resendKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)

    let sent = 0
    let failed = 0
    for (const r of recipients) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [r.email],
            subject,
            html,
            text,
          }),
        })
        if (res.ok) {
          sent++
          // Mark as notified
          const table = type === 'follow' ? 'festival_follows' : 'festival_requests'
          await supabase.from(table).update({ notified_at: new Date().toISOString() }).eq('id', r.rowId)
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    // Log
    await supabase.from('notification_log').insert({
      type: type === 'follow' ? 'timetable_drop' : 'request_fulfilled',
      festival_id,
      recipient_count: sent,
      success: failed === 0,
      error: failed > 0 ? `${failed} failed` : null,
    })

    return json({ sent, failed, total: recipients.length })
  }

  return json({ error: 'Method not allowed' }, 405)
})
