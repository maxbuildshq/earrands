import { callClaude, extractJsonBlock } from './extract/claude-cli.js'
import type { Suspicion } from './parse-detector.js'

/**
 * Parsing arbiter — one batched local `claude` CLI call that proposes
 * corrections for names the detector flagged as novel/unclean, checked
 * against the known artist catalogue. Suggestions only: nothing here writes
 * to the DB or changes the rule-based parser; output is persisted as
 * pending suggestions for human review in admin.
 */

export type ArbiterSuggestion = {
  raw: string
  collective: string | null
  members: string[]
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export function buildArbiterPrompt(flagged: Suspicion[], knownArtists: string[]): string {
  const cases = flagged.map(s => ({
    raw: s.raw,
    current_parse: { collective: s.parsed.collective, members: s.parsed.members },
    flags: s.reasons,
  }))
  return [
    'You arbitrate artist-name parsing for an electronic music festival timetable.',
    'Each case below is a raw billed name whose rule-based parse looks suspicious, with the current parse and why it was flagged.',
    'For each case, decide the correct split into individual performers (and an optional collective/show name).',
    'Prefer matching performers to the KNOWN ARTISTS list (exact names from our catalogue) — a near-miss spelling of a known artist is almost always that artist.',
    'A show concept after "presents"/"debuts" is not a performer. MCs and hosts are performers.',
    'Never invent performers not present in the raw name.',
    '',
    'Confidence: "high" = every member matches a known artist or the split is unambiguous; "medium" = plausible but at least one member is uncatalogued; "low" = genuinely ambiguous.',
    '',
    `KNOWN ARTISTS (${knownArtists.length}):`,
    knownArtists.join(', '),
    '',
    'CASES:',
    JSON.stringify(cases, null, 2),
    '',
    'Output ONLY a JSON array — no markdown fences, no commentary — one entry per case, same order:',
    '[{ "raw": string, "collective": string | null, "members": string[], "confidence": "high" | "medium" | "low", "reason": string }]',
    'reason: one short sentence explaining the decision.',
  ].join('\n')
}

/** Validate one parsed response entry; returns null when malformed. */
export function readSuggestion(entry: unknown): ArbiterSuggestion | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>
  if (typeof e.raw !== 'string' || e.raw.length === 0) return null
  if (e.collective !== null && typeof e.collective !== 'string') return null
  if (!Array.isArray(e.members) || e.members.length === 0 || !e.members.every(m => typeof m === 'string' && m.length > 0)) return null
  if (e.confidence !== 'high' && e.confidence !== 'medium' && e.confidence !== 'low') return null
  return {
    raw: e.raw,
    collective: (e.collective as string | null),
    members: e.members as string[],
    confidence: e.confidence,
    reason: typeof e.reason === 'string' ? e.reason : '',
  }
}

/** Run one batched arbitration. Returns only well-formed suggestions whose raw matches a flagged case. */
export function runArbiter(flagged: Suspicion[], knownArtists: string[]): ArbiterSuggestion[] {
  if (flagged.length === 0) return []
  const raw = callClaude(buildArbiterPrompt(flagged, knownArtists), { timeout: 300_000 })
  const parsed = JSON.parse(extractJsonBlock(raw))
  if (!Array.isArray(parsed)) throw new Error('arbiter returned non-array JSON')
  const flaggedRaws = new Set(flagged.map(s => s.raw))
  const out: ArbiterSuggestion[] = []
  for (const entry of parsed) {
    const s = readSuggestion(entry)
    if (s && flaggedRaws.has(s.raw)) out.push(s)
  }
  return out
}
