import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Welcome email on signup confirmation (docs/onboarding-strategy.md, Layer C).
 * Called by a pg_net trigger on auth.users (migration 029). Strictly functional
 * content — not gated on marketing consent (transactional / legitimate interest).
 *
 * Secrets: RESEND_API_KEY, NOTIFY_FROM_EMAIL, WELCOME_EMAIL_SECRET.
 */

const APP_URL = 'https://earrands.app/app'

function buildWelcomeHtml(): string {
  return `<div style="font-family:'Space Mono',monospace;background:#0A0A0A;color:#E5E5E5;padding:24px;">
  <p style="color:#CCFF00;font-weight:bold;font-size:18px;margin:0 0 16px;letter-spacing:1px;">EARRANDS - IYKYK festival planner</p>
  <p style="margin:0 0 16px;color:#FFFFFF;">You're in. Here's how it works:</p>
  <p style="margin:0 0 8px;"><strong style="color:#CCFF00;">Tap a set.</strong> Bio, socials, music — see who you're about to watch.</p>
  <p style="margin:0 0 8px;"><strong style="color:#CCFF00;">Pick your sets, we'll handle the clashes.</strong> Tap + on any set to build your own schedule — overlapping picks get flagged, so you can decide before you're mid-crowd.</p>
  <p style="margin:0 0 8px;"><strong style="color:#CCFF00;">Send it to the group.</strong> Share your schedule as an image on social media or as link so friends can save it to their own account.</p>
  <p style="margin:0 0 8px;"><strong style="color:#CCFF00;">Rate what you heard.</strong> Thumbs up or down after a set. Your history carries to the next festival.</p>
  <!-- <p style="margin:0 0 24px;"><strong style="color:#CCFF00;">Works offline.</strong> Save your battery for the night.</p> -->
  <a href="${APP_URL}" style="display:inline-block;background:#CCFF00;color:#0A0A0A;font-weight:bold;text-decoration:none;padding:12px 20px;text-transform:uppercase;letter-spacing:1px;">Open earrands</a>
  <p style="margin:24px 0 0;font-size:12px;color:#888;">You're getting this once because you created an earrands account. That's it — no more emails unless you asked for them.</p>
</div>`
}

function buildWelcomeText(): string {
  return `You're in. Here's how it works:

Tap a set — bio, socials, music, see who you're about to watch.
Pick your sets, we'll handle the clashes — tap + on any set to build your own schedule, overlapping picks get flagged.
Send it to the group — share your schedule as a link or a poster.
Rate what you heard — thumbs up or down after a set.
Works offline — save your battery for the night.

${APP_URL}

You're getting this once because you created an earrands account. That's it — no more emails unless you asked for them.`
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (req.headers.get('x-welcome-secret') !== Deno.env.get('WELCOME_EMAIL_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }

  const { user_id: userId, email } = await req.json()
  if (!userId || !email) return new Response('missing user_id/email', { status: 400 })

  // Dedup: first insert wins; a repeat trigger fire (or retry) becomes a no-op.
  const supabase = getServiceClient()
  const { error: insertError } = await supabase
    .from('welcome_emails')
    .insert({ user_id: userId })
  if (insertError) {
    if (insertError.code === '23505') return new Response('already sent', { status: 200 })
    return new Response(`dedup insert failed: ${insertError.message}`, { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('NOTIFY_FROM_EMAIL'),
      to: email,
      subject: "You're in — here's how earrands works",
      html: buildWelcomeHtml(),
      text: buildWelcomeText(),
    }),
  })

  if (!res.ok) {
    // Roll back the dedup row so a retry can send.
    await supabase.from('welcome_emails').delete().eq('user_id', userId)
    return new Response(`resend failed: ${await res.text()}`, { status: 502 })
  }

  return new Response('sent', { status: 200 })
})
