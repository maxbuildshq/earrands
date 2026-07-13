# 011 — Enrichment Source Reliability Hierarchy & Entity Resolution

**Status**: Living draft (started 2026-07-13, Phase 1a shipped; updated as Phase 1 lands)

## Context

Adding a festival (~100 new artists) costs 4–6h of manual review, dominated by one failure
mode: **wrong entity, right name**. A wrong Discogs ID poisons image candidates with another
person's photo while the socials can still be correct. Generic artist names match multiple
entities on every source. More sources ≠ better — the problem is disambiguation.

## Decision

**Identity = cross-source link agreement, never name-match or search score.** A source's
claim about an artist is trusted in proportion to independent sources linking the same
profile through paths not derived from the same search. Implemented as per-field confidence
`{ level: high|medium|low, evidence: string[] }` (`scripts/lib/enrichment/confidence.ts`,
behind `enrich --resolver=graph`; legacy path unchanged).

### Source verdicts — including dead ends, so we don't re-propose them

Full research: [docs/spikes/2026-07-enrichment-source-spike.md](../spikes/2026-07-enrichment-source-spike.md)

| Source | Verdict | Reason (don't re-litigate without new facts) |
|---|---|---|
| SoundCloud (scrape) | **Root node** | The platform for electronic music artists. Downstream fields (IG link, avatar, location) are artist-asserted — identity confidence ≠ content accuracy. Followers are platform-derived (no content caveat). |
| Brave Search | Discovery + standing corroboration | Finds SC/IG; also run as an independent corroboration node when values are already known (conflict detection). |
| Discogs | Supplementary; confidence-tagged | Name search hits wrong entities; its ID is corroborated by its own outbound links to independently-found SC/IG/Bandcamp, or by MB listing the same ID (any-of — MB often lists several). Images always collected, **tagged never excluded**. |
| MusicBrainz | **Corroboration-only** | Core data (URL relations) is CC0 — commercially clean; NC terms cover only tags/ratings/Live Data Feed (unused). No API key exists; 1 req/s + User-Agent. 10/10 SC corroboration on popular tier; wrong entities corroborate nothing (can confirm, never poison). Exact-name match required — search score is meaningless. Evidence held in memory only; nothing MB-derived stored. |
| Spotify API | **DEAD END** | Developer Policy: link-back + Spotify-marks per displayed item; no standalone metadata; no database building; no mixing with other services. Four clauses against our model. Even the free `spotify_url` link (via MB) was declined (2026-07-13). |
| Wikidata | **DEAD END** | CC0 but 4/15 name-search hits were wrong entities (Andy C → Andy Cohen); zero obscure-artist coverage; MB links to it anyway. |
| Resident Advisor | **BANNED** | Product decision (competitor) — never a data source, link, or recommendation. |
| Festival press photos | **Reference only** | Never a candidate, never user-facing (organizer relations + licensing). Admin-side visual reference for wrong-person warnings only. |

### Confidence & dependency tree

| Field | Source order | Corroboration → confidence |
|---|---|---|
| `soundcloud_url` (root) | Brave → (Discogs fallback) | high: MB or Discogs independently links same SC · medium: found, uncorroborated · low: not found |
| `discogs_id` | Discogs name search | high: its page links our SC/IG/Bandcamp, or MB lists same ID · medium: name-only · low: links a different SC — tags its images, never excludes them |
| `instagram_url` | SC profile link → Discogs → Brave (always, as corroboration) | SC-linked inherits SC identity · 2+ agree = high · single = medium · conflict = low |
| `image_url` | candidates from ALL sources, confidence-tagged | winner rank: tier → SC-avatar-wins-within-tier (freshest; SC is the identity target) → DETR score |
| `bandcamp_url` | SC profile link → Discogs → Brave | SC-linked inherits SC identity (trusted SC alone = high) · others need agreement |
| `city`/`country_code` | SC → Bandcamp | artist-asserted → capped at medium; normalization inferences highlighted in admin |
| `soundcloud_followers` | SC only | = SC identity confidence (platform-derived) |

**Human confirmation is the highest tier**: touching a field → `high` + `admin-confirmed <date>`;
approving the artist as a whole → all populated fields `high` + `admin-approved <date>`.
Machine confidence stays in the evidence trail as provenance. Human-vetted fields anchor
future re-enrichment. *(Lands with the review queue — Phase 1d/1e.)*

### Apply-then-review

Enrichment applies with `enrichment_status='pending'`; 100% of records pass human review in
the admin queue (grouped by aggregated confidence, per-field evidence chips, image carousel).
Never auto-approve. Review speed, not automation trust, is the scaling lever.

### Visual reference check (planned, Phase 1e)

Workers AI has no CLIP-class embedding model → vision-LLM check instead, one call asking
both "same person?" and "same/near-identical photo?" (the latter doubles as carousel dedupe).
Warning only, never a gate. ~5–10× DETR's neuron cost; measured during validation.

### API budget visibility (planned, Phase 1g)

Per-vendor usage counters (Brave monthly quota, Discogs req/min, Workers AI neurons/day,
MB req/s, SC req/s) persisted and surfaced in an admin panel — "how many artists can I
enrich this month" must be answerable at a glance, plus preflight estimates before big runs.

## Consequences

- Every field carries provenance; admin review prioritizes low/conflict items.
- Wrong-entity damage is structurally limited: uncorroborated sources can't outrank
  corroborated ones, and no candidate is ever hidden.
- Two rejected sources + one banned source are documented above with reasons — check this
  table before proposing any new data source.
