#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import { createInterface } from 'node:readline'
import { parseNotifyArgs, buildSubject, buildEmailHtml, buildEmailText } from './lib/notify-helpers.js'

// ── CLI ──────────────────────────────────────────────────────────────────────

const { slug, matchTerm, listMode, dryRun } = parseNotifyArgs(process.argv.slice(2))

if (!slug && !listMode) {
  console.log(`Usage:
  npm run notify -- --festival=<slug>
      Email followers that the timetable for <slug> is live (timetable-drop flow).

  npm run notify -- --festival=<slug> --match-requests="<search term>"
      Email requesters whose raw_name contains <search term> that their festival was added.

  npm run notify -- --list-requests
      List all pending (unnotified) festival requests with requester emails.

  Add --dry-run to any command to preview without sending.`)
  process.exit(0)
}

console.log('earrands — Notifier')
console.log('─────────────────────────')
if (dryRun) console.log(chalk.yellow('DRY RUN — no emails will be sent'))
console.log()

// ── Env ──────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendKey = process.env.RESEND_API_KEY
const fromEmail = process.env.NOTIFY_FROM_EMAIL
const appBaseUrl = process.env.APP_BASE_URL ?? 'https://earrands.app/app'

if (!supabaseUrl || !serviceKey) {
  console.error(chalk.red('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'))
  process.exit(1)
}
if (!listMode && !dryRun && (!resendKey || !fromEmail)) {
  console.error(chalk.red('Missing RESEND_API_KEY or NOTIFY_FROM_EMAIL in .env.local (required to send)'))
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type Recipient = { userId: string; email: string }

// ── Mode: list pending requests ───────────────────────────────────────────────

async function listRequests() {
  const { data: requests, error } = await supabase
    .from('festival_requests')
    .select('id, user_id, raw_name, region, created_at')
    .is('notified_at', null)
    .order('raw_name')

  if (error) {
    console.error(chalk.red('Failed to load requests:'), error.message)
    process.exit(1)
  }
  if (!requests || requests.length === 0) {
    console.log(chalk.green('No pending requests.'))
    return
  }

  // Group by lowercased name
  const groups = new Map<string, typeof requests>()
  for (const r of requests) {
    const key = r.raw_name.toLowerCase().trim()
    groups.set(key, [...(groups.get(key) ?? []), r])
  }

  console.log(chalk.bold(`  ${requests.length} pending request(s) across ${groups.size} unique name(s):\n`))

  for (const [, rows] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const label = rows[0].raw_name
    console.log(chalk.bold(`  ${label}`) + chalk.dim(` (${rows.length})`))
    for (const r of rows) {
      const { data } = await supabase.auth.admin.getUserById(r.user_id)
      const email = data?.user?.email ?? chalk.dim('(unconfirmed)')
      const region = r.region ? chalk.dim(` · ${r.region}`) : ''
      console.log(`    • ${email}${region}`)
    }
    console.log()
  }

  console.log(chalk.dim(`  To notify: npm run notify -- --festival=<slug> --match-requests="<name>"`))
}

// ── Mode: notify requesters ───────────────────────────────────────────────────

async function notifyRequesters(festivalSlug: string, term: string) {
  const { data: festival, error: fErr } = await supabase
    .from('festivals')
    .select('id, name, slug')
    .eq('slug', festivalSlug)
    .single()

  if (fErr || !festival) {
    console.error(chalk.red(`Festival not found for slug: ${festivalSlug}`))
    process.exit(1)
  }

  const { data: requests, error: rErr } = await supabase
    .from('festival_requests')
    .select('id, user_id, raw_name, region')
    .is('notified_at', null)
    .ilike('raw_name', `%${term}%`)

  if (rErr) {
    console.error(chalk.red('Failed to load requests:'), rErr.message)
    process.exit(1)
  }
  if (!requests || requests.length === 0) {
    console.log(chalk.green(`No pending requests matching "${term}". Nothing to send.`))
    return
  }

  // Resolve emails
  const recipients: (Recipient & { requestId: string })[] = []
  for (const r of requests) {
    const { data, error } = await supabase.auth.admin.getUserById(r.user_id)
    if (error || !data.user?.email || !data.user.email_confirmed_at) continue
    recipients.push({ userId: r.user_id, email: data.user.email, requestId: r.id })
  }

  console.log(`  Festival: ${chalk.bold(festival.name)}`)
  console.log(`  Match term: "${term}"`)
  console.log(`  ${requests.length} matching request(s) → ${recipients.length} confirmed email(s)\n`)
  for (const r of recipients) console.log(`    • ${r.email}`)
  console.log()

  if (dryRun) {
    console.log(chalk.yellow('Dry run complete — no emails sent, no rows updated.'))
    return
  }
  if (recipients.length === 0) {
    console.log('No confirmed recipients — nothing to send.')
    return
  }

  const ok = await confirm(`Send "your requested festival is live" email to ${recipients.length} user(s)?`)
  if (!ok) { console.log(chalk.dim('Aborted.')); return }

  const scheduleUrl = `${appBaseUrl}/festivals/${festival.slug}/schedule`
  const sent: string[] = []
  const sentRequestIds: string[] = []

  for (const r of recipients) {
    const success = await sendEmail(r.email, festival.name, scheduleUrl, 'request')
    if (success) {
      sent.push(r.userId)
      sentRequestIds.push(r.requestId)
      console.log(chalk.green(`    ✓ ${r.email}`))
    } else {
      console.log(chalk.red(`    ✕ ${r.email}`))
    }
  }

  if (sentRequestIds.length > 0) {
    const { error } = await supabase
      .from('festival_requests')
      .update({ notified_at: new Date().toISOString() })
      .in('id', sentRequestIds)
    if (error) console.error(chalk.red('\nFailed to mark notified_at:'), error.message)
  }

  console.log(chalk.bold(`\n  Sent ${sent.length}/${recipients.length}. Marked ${sent.length} request(s) as notified.`))
}

// ── Mode: notify followers (timetable drop) ───────────────────────────────────

async function notifyFollowers(festivalSlug: string) {
  const { data: festival, error: fErr } = await supabase
    .from('festivals')
    .select('id, name, slug')
    .eq('slug', festivalSlug)
    .single()

  if (fErr || !festival) {
    console.error(chalk.red(`Festival not found for slug: ${festivalSlug}`))
    process.exit(1)
  }

  const { data: follows, error: flErr } = await supabase
    .from('festival_follows')
    .select('id, user_id')
    .eq('festival_id', festival.id)
    .is('notified_at', null)

  if (flErr) {
    console.error(chalk.red('Failed to load follows:'), flErr.message)
    process.exit(1)
  }
  if (!follows || follows.length === 0) {
    console.log(chalk.green(`No pending followers for ${festival.name}. Nothing to send.`))
    return
  }

  // Resolve emails
  const recipients: Recipient[] = []
  for (const f of follows) {
    const { data, error } = await supabase.auth.admin.getUserById(f.user_id)
    if (error || !data.user?.email || !data.user.email_confirmed_at) continue
    recipients.push({ userId: f.user_id, email: data.user.email })
  }

  console.log(`  ${chalk.bold(festival.name)}`)
  console.log(`  ${follows.length} pending follow(s) → ${recipients.length} confirmed email(s)\n`)
  for (const r of recipients) console.log(`    • ${r.email}`)
  console.log()

  if (dryRun) {
    console.log(chalk.yellow('Dry run complete — no emails sent, no rows updated.'))
    return
  }
  if (recipients.length === 0) {
    console.log('No confirmed recipients — nothing to send.')
    return
  }

  const scheduleUrl = `${appBaseUrl}/festivals/${festival.slug}/schedule`
  const sent: string[] = []

  for (const r of recipients) {
    const success = await sendEmail(r.email, festival.name, scheduleUrl, 'follow')
    if (success) {
      sent.push(r.userId)
      console.log(chalk.green(`    ✓ ${r.email}`))
    } else {
      console.log(chalk.red(`    ✕ ${r.email}`))
    }
  }

  if (sent.length > 0) {
    const { error } = await supabase
      .from('festival_follows')
      .update({ notified_at: new Date().toISOString() })
      .eq('festival_id', festival.id)
      .in('user_id', sent)
    if (error) console.error(chalk.red('\nFailed to mark notified_at:'), error.message)
  }

  console.log(chalk.bold(`\n  Sent ${sent.length}/${recipients.length}. Marked ${sent.length} as notified.`))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  festivalName: string,
  scheduleUrl: string,
  type: 'follow' | 'request',
): Promise<boolean> {
  const subject = buildSubject(festivalName, type)
  const html = buildEmailHtml(festivalName, scheduleUrl, type)
  const text = buildEmailText(festivalName, scheduleUrl, type)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail!, to, subject, html, text }),
    })
    if (!res.ok) {
      console.error(chalk.dim(`      ${res.status} ${await res.text()}`))
      return false
    }
    return true
  } catch (err) {
    console.error(chalk.dim(`      ${String(err)}`))
    return false
  }
}

function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(chalk.bold(`\n  ${question} [y/N] `), answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  if (listMode) {
    await listRequests()
  } else if (slug && matchTerm) {
    await notifyRequesters(slug, matchTerm)
  } else if (slug) {
    await notifyFollowers(slug)
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err)
  process.exit(1)
})
