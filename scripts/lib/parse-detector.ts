import type { ParseResult } from './artist-parser.js'

/**
 * Novel-pattern detector for the parsing arbiter (safety net, not a parser).
 * The rule-based parser in artist-parser.ts always returns *something* — when
 * a festival uses a convention the rules have never seen, the failure mode is
 * a silent bad parse (a separator left inside a member name, a comma list
 * swallowed as one "solo" artist). This flags those cases so a batched LLM
 * arbitration can propose corrections for human review. Known-good parses are
 * never touched; this only ever *adds* review candidates.
 */

export type Suspicion = {
  raw: string
  parsed: ParseResult
  reasons: string[]
}

// Separator/qualifier tokens that should never survive inside a single
// member name after a clean parse. " & " is deliberately absent — a
// remaining ampersand means a KNOWN_DUOS exception, which is correct.
const LEFTOVER_TOKENS = /\s(?:b2b|f2f|vs|presents?|debuts?|featuring|feat\.?|ft\.?|hosted by|w\/)\s/i

/**
 * Inspect one raw name + its parse. Returns human-readable reasons (empty =
 * clean). `knownSortNames` — lowercase artists.sort_name values from the DB;
 * when provided, members not in it are flagged (the strongest novelty signal:
 * a "new artist" created by a bad split is a name no source has ever seen).
 */
export function detectSuspicions(
  raw: string,
  parsed: ParseResult,
  knownSortNames?: Set<string>,
): string[] {
  const reasons: string[] = []

  for (const member of parsed.members) {
    if (LEFTOVER_TOKENS.test(` ${member} `)) {
      reasons.push(`separator token left inside member "${member}"`)
    }
    const parens = (member.match(/\(/g)?.length ?? 0) - (member.match(/\)/g)?.length ?? 0)
    if (parens !== 0) {
      reasons.push(`unbalanced parentheses in member "${member}"`)
    }
    if (member.length > 60) {
      reasons.push(`implausibly long member "${member.slice(0, 40)}…" (${member.length} chars)`)
    }
    if (member.replace(/[^a-z0-9]/gi, '').length < 2) {
      reasons.push(`implausibly short member "${member}"`)
    }
  }

  // The parser has no bare-comma rule: "A, B, C" with no collective prefix
  // falls through to solo with the commas intact — a genuinely novel pattern.
  if (parsed.role === 'solo' && parsed.members.length === 1 && /,\s/.test(parsed.members[0])) {
    reasons.push(`comma list parsed as a single solo artist`)
  }

  if (knownSortNames) {
    for (const member of parsed.members) {
      if (!knownSortNames.has(member.toLowerCase())) {
        reasons.push(`member "${member}" unknown to artists table`)
      }
    }
    if (parsed.collective && !knownSortNames.has(parsed.collective.toLowerCase())) {
      reasons.push(`collective "${parsed.collective}" unknown to artists table`)
    }
  }

  return reasons
}

/**
 * Filter a batch of raw names down to the suspicious ones. `unknownAlone`
 * controls whether "unknown to artists table" by itself is enough to flag —
 * on a first ingest every artist is unknown, so callers pass false there and
 * true when re-parsing an established catalogue.
 */
export function detectBatch(
  entries: { raw: string; parsed: ParseResult }[],
  knownSortNames: Set<string> | undefined,
  opts: { unknownAlone?: boolean } = {},
): Suspicion[] {
  const out: Suspicion[] = []
  for (const { raw, parsed } of entries) {
    const reasons = detectSuspicions(raw, parsed, knownSortNames)
    const structural = reasons.filter(r => !r.includes('unknown to artists table'))
    const keep = opts.unknownAlone ? reasons : structural
    if (keep.length > 0) out.push({ raw, parsed, reasons })
  }
  return out
}
