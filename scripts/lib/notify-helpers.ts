/**
 * Pure-logic helpers for the notify script, extracted for testability.
 * No side effects, no Supabase, no Resend — just string building.
 */

export type EmailType = 'follow' | 'request'

export function parseNotifyArgs(argv: string[]) {
  const slug = argv.find(a => a.startsWith('--festival='))?.split('=').slice(1).join('=') ?? null
  const matchTerm = argv.find(a => a.startsWith('--match-requests='))?.split('=').slice(1).join('=') ?? null
  const listMode = argv.includes('--list-requests')
  const dryRun = argv.includes('--dry-run')
  return { slug, matchTerm, listMode, dryRun }
}

export function buildSubject(festivalName: string, type: EmailType): string {
  return type === 'follow'
    ? `The ${festivalName} timetable is live`
    : `${festivalName} is now on earrands`
}

export function buildEmailHtml(
  festivalName: string,
  scheduleUrl: string,
  type: EmailType,
): string {
  const headline = type === 'follow'
    ? `The <strong>${festivalName}</strong> timetable is live.`
    : `<strong>${festivalName}</strong> — the festival you requested — is now on earrands.`

  const subline = type === 'follow'
    ? 'You asked us to let you know — here it is.'
    : 'You asked for it, we added it.'

  const unsubNote = type === 'follow'
    ? `You're getting this because you followed ${festivalName} on earrands. To stop these, unfollow it in the app.`
    : `You're getting this because you requested ${festivalName} on earrands.`

  return `<div style="font-family:'Space Mono',monospace;background:#0A0A0A;color:#E5E5E5;padding:24px;">
  <p style="color:#CCFF00;font-weight:bold;font-size:18px;margin:0 0 16px;letter-spacing:1px;">EARRANDS</p>
  <p style="margin:0 0 8px;">${headline}</p>
  <p style="margin:0 0 24px;color:#FFFFFF;">${subline}</p>
  <a href="${scheduleUrl}" style="display:inline-block;background:#CCFF00;color:#0A0A0A;font-weight:bold;text-decoration:none;padding:12px 20px;text-transform:uppercase;letter-spacing:1px;">View the timetable</a>
  <p style="margin:24px 0 0;font-size:12px;color:#888;">${unsubNote}</p>
</div>`
}

export function buildEmailText(
  festivalName: string,
  scheduleUrl: string,
  type: EmailType,
): string {
  const subline = type === 'follow'
    ? 'You asked us to let you know — here it is.'
    : 'You asked for it, we added it.'

  const unsubNote = type === 'follow'
    ? `You're getting this because you followed ${festivalName} on earrands. To stop these, unfollow it in the app.`
    : `You're getting this because you requested ${festivalName} on earrands.`

  return `${festivalName} — ${subline}\n\n${scheduleUrl}\n\n${unsubNote}`
}

export function buildShareFilename(festivalName: string): string {
  return `earrands-${festivalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
}
