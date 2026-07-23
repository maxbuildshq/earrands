# scripts/ — Ingest, Notify, Artist Parsing, Enrichment

## NPM Scripts

```bash
npm run dev             # Local dev server
npm run build           # tsc + vite build → dist/
npm run deploy          # build + wrangler deploy (see docs/decisions/006)

# Ingest
npm run ingest -- --url=<festival-event-url>           # scrape → diff → generate SQL
npm run ingest -- --url=<url> --dry-run                # preview diff only
npm run ingest -- --url=<url> --skip-bios              # skip artist bio pages
npm run ingest -- --json=<path>                        # ingest from pre-scraped JSON
npm run ingest -- --url=<url> --extract=llm            # force LLM extraction (skip adapter)

# Artist normalization
npm run parse-artists                                  # re-parse all artists globally
npm run parse-artists -- --festival=<slug>             # one festival only
npm run parse-artists -- --dry-run                     # preview, no DB writes
npm run parse-artists -- --festival=<slug> --arbiter   # + parsing arbiter: detect novel parses, LLM suggestions for admin review

# Notifications
npm run notify -- --festival=<slug>                    # email timetable-drop followers
npm run notify -- --festival=<slug> --dry-run          # preview recipients, no send
npm run notify -- --list-requests                      # list all pending requests + emails
npm run notify -- --festival=<slug> --match-requests="<term>"
npm run notify -- --festival=<slug> --match-requests="<term>" --dry-run

# Artist enrichment (images, social links, SoundCloud embeds)
npm run enrich                                         # enrich all unenriched artists
npm run enrich -- --festival=<slug>                    # one festival only
npm run enrich -- --artist="Speedy J"                  # single artist (testing)
npm run enrich -- --dry-run                            # preview, no DB writes
npm run enrich -- --force                              # re-enrich all (ignore enriched_at)
npm run enrich -- --limit=30                           # process max N artists (pace Google quota)
npm run enrich -- --resume                             # continue from last saved progress
npm run enrich -- --fields=bandcamp                    # only fetch specific fields
npm run enrich -- --fields=instagram,image             # comma-separated
npm run enrich -- --fields=followers                   # refetch just SoundCloud follower count
npm run enrich -- --apply=enrichment-review/X.json     # apply reviewed file to DB
npm run enrich -- --resolver=graph                     # MusicBrainz corroboration + per-field confidence (default: legacy)
npm run enrich -- --fields=image-candidates --resolver=graph --limit=25
                                                       # backfill candidate sets only — image_url winner + enrichment_status untouched
```

## Adding a Festival (automated ingest)

For festivals with a scraper adapter (Awakenings, Dekmantel):

```bash
npm run ingest -- --url=<festival-event-url>
```

Scrapes → diffs against DB → shows preview → generates a complete upsert SQL at `supabase/migrations/`. Run the SQL in Supabase SQL Editor.

For festivals without an adapter, ingest **auto-falls back to LLM extraction** (`--extract=llm` forces it even when an adapter matches):

1. `scripts/lib/extract/page-dump.ts` — Playwright dump: visible DOM text, embedded payloads (`__NUXT__`, `__NEXT_DATA__`, ld+json), JSON XHR responses, image URLs (festival press photos → `artists[].image_url`, admin visual reference only per ADR 011). Saved to `scraped/dump-<hostname>.json` for debugging.
2. `scripts/lib/extract/llm-extract.ts` — local `claude` CLI (no API key). Small dumps: agentic single-shot (`--allowed-tools Read,Grep,Write`, writes the result file itself — chat output truncates on large extractions). Large payloads: `chunk.ts` finds the biggest array of similarly-shaped records (the lineup, whatever the framework) and extracts it in ~80 KB batches, merged in code. `validateScrapedData()` checks shape, slug/date/time formats, stage references, and duplicate sets before anything reaches the diff.
3. Output feeds the **same diff preview / flags / SQL generation** as adapters — the diff review is the safety gate.

**Framework-payload caveat (learned on Dekmantel):** embedded CMS data is only as good as the festival's data hygiene — always spot-check a few extracted times/dates against the live page before trusting a new adapter or LLM-extraction run.

If validation fails, inspect the dump, hand-fix into a `--json` file, or write an adapter. **Adapters are for repeat organizers and LLM failures — never written speculatively.**

Pre-extracted JSON still works directly:

```bash
npm run ingest -- --json=scraped/some-festival.json
```

## Poster/Image Timetable Extraction

Some festivals (Dekmantel) publish the timetable only as designed poster PNGs, not structured data — no DOM/CMS payload to extract times from. `scripts/lib/extract/poster-vision.ts` reads these via a calibrated, per-column vision pass: **pixels decide WHERE the grid is, vision reads WHAT's in it.**

1. `prepareWorkImage()` downscales the poster to `MAX_DIM = 2000px` long edge before any vision call — this matches (with margin) the resolution Claude's image input downscales to internally, so every pixel coordinate reported by vision and computed by the pipeline lives in one consistent space.
2. One vision call reads geometry only: grid top/bottom hour-line Y, first/last hour, axis span, grid outer x-span, ordered column (stage) names — no per-column boundaries, no names yet.
3. `columnBounds()` divides the grid into N equal-width columns from the ordered name list (no vision call) — poster grids use uniform column width, so an even division never clips text. (Asking vision for each column's own x-fraction was tried first and was unreliable on interior boundaries — it clipped/duplicated columns.)
4. Per stage, `sliceColumns()` cuts a full-height `[hour-axis | column]` strip; `detectBoundaries()` finds full-width dark gridlines contrast-relative to that strip's own background (works across near-black to near-white posters), and `boundaryTimes()` snaps them to the 15-minute grid — this pixel-derived time is always used over vision's own time estimate, since vision systematically rounds sub-hour boundaries toward the heavier whole-hour gridlines.
5. One vision call per stage reads that column's set blocks (artist name + live-flag + approximate top/bottom Y). `alignByOverlap()` (DP) assigns each block to the pixel-detected time slot it overlaps most — not the slot with the closest *start* — so an hour-biased vision estimate next to an empty gap can't steal a name into the wrong slot. Returns `null` (strip flagged, vision-only times used as fallback) when there are more names than detected slots — happens on very densely packed columns where gridlines are too faint/close to detect (e.g. Dekmantel Radar: nine ~1h back-to-back sets).
6. `matchCanonical()` in the adapter (Dekmantel: `scripts/scrapers/dekmantel.ts`) Levenshtein-corrects poster-read names against the authoritative Nuxt lineup spelling — poster is the time authority, Nuxt/CMS is the name+bio authority.

Verified on Dekmantel 2026-08-02 (39/39 sets, 6/7 stages exact-precision) and 2026-07-30 (all correct). Cost: 1 calibration call + 1 call per stage column, local `claude` CLI.

## Adding a Festival (manual fallback)

1. Write `supabase/migrations/00X_festivalname.sql` — insert festival, stages, sets
2. Run in Supabase SQL Editor
3. `npm run parse-artists -- --festival=<slug>` to populate artists + set_artists

## Notify Workflow (after adding a festival)

1. Add & verify the festival in the app
2. `npm run notify -- --list-requests` — see pending requests
3. `npm run notify -- --festival=<slug> --match-requests="<name>" --dry-run` — preview matches
4. Re-run without `--dry-run` to send
5. For timetable drops (lineup-only → announced): `npm run notify -- --festival=<slug>`

`notify.ts` looks up emails via Supabase auth admin API at send time — there is no `email` column on `festival_follows` or `festival_requests`.

## Ingest Pipeline Architecture

```
Scraper adapters (per-festival)  →  ScrapedData JSON  →  ingest.ts  →  SQL migration
                                                               ↕
                                                      Supabase (current DB state for diff)
```

Each adapter: `(url: string) => Promise<ScrapedData>` in `scripts/scrapers/`. Registry in `scripts/scrapers/index.ts` maps URL patterns to adapters.

Current adapters:
- **Awakenings** (`awakenings.com`) — all Awakenings events (Upclose, Festival, ADE, Easter, Monegros)
- **Dekmantel** (`dekmantelfestival.com`) — extracts `__NUXT__` payload via Playwright for names/bios/stages; timetable is a poster PNG per day, not in the payload — times come from poster-vision extraction (above), merged onto Nuxt names by fuzzy match

### Adding a new adapter

1. Create `scripts/scrapers/<name>.ts` exporting a `ScraperAdapter` function
2. Register in `scripts/scrapers/index.ts` with a URL pattern
3. Return `ScrapedData` (see `scripts/scrapers/types.ts`)

### Combo bios in the pipeline

The artist parser returns `collective: null` for `&` collab patterns (temporary collaborations, not permanent collectives). For combo bios (Dekmantel-style — one bio per timeslot):

- After inserting member artists, check if `scrapedBios` has an entry for the full `set.artist_name` (lowercased)
- If yes: create an additional artist entry with `is_collective: false`, link via `set_artists` with `billing_order: 0`
- This puts the combo bio in the DB alongside individual bios

See `docs/decisions/005` for how the frontend displays these.

### Performance type (live / hybrid)

`sets.performance_type` (`'live' | 'hybrid' | null`, migration 040) is the **single source of truth** for a set's mode — the column the UI reads for the Live/Hybrid badge. The legacy `sets.is_live` boolean was **retired** (dropped in migration 041, see ADR 012).

`ScrapedSet.performance_type` is what scrapers emit and `generateSql` writes **directly on every set insert/update** — no `is_live`, no per-migration backfill (do not add one; migrations ≤040 backfilled only because the pipeline predated this). Mark a live set `'live'`, a hybrid set `'hybrid'`, a normal DJ set `null`. Defensive fallback: `validateScrapedData` (LLM path) maps any stray legacy `is_live` boolean a model still emits to `performance_type`, so nothing is lost. `poster-vision`'s internal `VisionBlock.is_live` is the vision model's raw live-tag read, converted to `performance_type` where the `ScrapedSet` is built — not the retired column.

## Artist Normalization

Parsing in `scripts/lib/artist-parser.ts` (shared by `ingest.ts` and `parse-artists.ts`).

### Parsing arbiter (Phase 2b — novel-pattern safety net)

The rule-based parser always returns *something*; on an unseen billing convention the failure mode is a silent bad parse. `parse-artists -- --festival=<slug> --arbiter` (flag-gated, default off) adds a safety net without touching the rules:

1. **Detector** (`scripts/lib/parse-detector.ts`, pure logic) — flags parses with leftover separator tokens inside a member, bare-comma lists swallowed as one "solo" artist, unbalanced parens, implausible lengths. "Unknown to `artists`" is attached as supporting evidence but never flags on its own (on a fresh festival every artist is unknown). Measured noise: 0 flags across 4 established festival catalogues, 1 true catch ("Featuring You! Hosted by House of Dinosaur") on the fifth.
2. **Arbiter** (`scripts/lib/arbiter.ts`) — ONE batched local `claude` CLI call: flagged cases + the known artist catalogue in, `{ collective, members, confidence, reason }` suggestions out. Malformed entries dropped.
3. **Persistence** — suggestions upserted into `parse_suggestions` (migration 038) as `pending`; names with an existing suggestion (any status) are never re-arbitrated, so a dismissal sticks.
4. **Review** — AdminSets shows pending suggestions grouped by confidence with one-tap accept/dismiss (status flip via the admin-festivals edge function). **Accepting does not write set_artists** — the next `parse-artists --arbiter` run applies accepted suggestions as parse overrides.
5. `--dry-run` runs the detector and prints flags but makes no LLM call and writes nothing.

Accepted cases worth keeping should also be added as fixtures in `artist-parser.test.ts` (that's the long-term fix; the arbiter is the stopgap).

Pre-processing: strips `(live)`, trailing `Live`, and mid-name `Live` before qualifiers like `(` or `w/`.

Parsing rules (priority order):
1. `hosted by`: `"Serum hosted by Carasel"` (main act + MC)
2. `presents`/`present`/`debuts`/`debut`: `"A Guy Called Gerald presents Black Secret Technology"`, `"Jeff Mills debuts STARGATE"` — the part after the verb is a show concept, not a member, and is dropped; the artist(s) before it are re-parsed on their own so a compound presenter (`"James Holden & Surgeon present ..."`) still splits
3. Colon format: `"LSD: Luke Slater, Steve Bicknell and Function"`
4. Parenthetical with `,` or `&`: `"Collabs 3000 (Chris Liebing & Speedy J)"`
5. `w/`: `"STOOR w/ Aurora Halal, Azu Tiwaline"` (collective + members)
6. `featuring` (case-insensitive)
7. `F2F` (case-insensitive)
8. `B2B` (case-insensitive)
9. `vs`
10. `x` (case-sensitive, space-x-space — won't match "DAX J")
11. `&`
12. Solo

## Artist Enrichment

Pipeline in `scripts/lib/enrichment/`. Populates `artists.image_url`, `instagram_url`, `soundcloud_url`, `soundcloud_embed_url`, `bandcamp_url`, `city`, `country_code`, `soundcloud_followers`, and bio research data.

### Pipeline flow per artist

1. **Brave Search** → find SoundCloud profile URL (`"<name>" dj music site:soundcloud.com`)
2. **Brave Search** → (if IG still missing) find Instagram (`"<name>" dj music site:instagram.com`)
3. **Discogs** → supplementary image candidates (up to 5), Bandcamp URL, SC/IG fallback, bio profile text
4. **SoundCloud profile scrape** → image candidate, Instagram cross-ref, city/country_code and `followers_count` (popularity signal for ranking) from the same hydration JSON, SC description as bio fragment
5. **Bandcamp location fallback** → if SC location missing and Bandcamp URL found, scrape location from Bandcamp page
6. **Image scoring** (when Cloudflare credentials available) → Cloudflare DETR person detection across all image candidates; picks best person photo
7. **Instagram resolution** → multi-source cross-reference: SC profile link (most authoritative) → Discogs → Brave Search; conflicts flagged in review notes
8. **SoundCloud oEmbed** → validate embed URL
9. **Bio research** (when `--fields=bio`) → Brave Search for biography pages (5 query exclusions in-query; full 24-domain exclusion list client-side), fetch up to 5 pages with content relevance check, bundle with SC/Discogs/festival bios into `bio_research` JSONB
10. **AI bio generation** (when `--fields=bio`) → calls `claude -p --model sonnet` **inline, right after this artist's other sources are gathered** (not a second pass over the list); writes result directly to `artists.bio_generated` in DB. Skipped on `--dry-run`.

The CLI progress row tags each **queried** source by outcome — green when data was found, red on miss/error (`img, ig, sc, dc, mb, bio-res, bio`); opportunistic/derived fields (`embed, bc, loc, followers`) show green-when-present only. The run summary names the not-found / errored / not-processed artists and prints a per-vendor API-call census.

Skips combo/temporary artist entries (B2B placeholders with `is_collective: false` + `&`/`b2b`/`vs` in sort_name).

### Graph resolver (`--resolver=graph`)

Opt-in entity-resolution mode; default stays `legacy` (behavior unchanged). Adds:
- **MusicBrainz corroboration** (`musicbrainz.ts`) — evidence-only, never supplies field values. Core data (URL relations) is CC0; 1 req/s + User-Agent required. Non-exact name matches are discarded (MB search score is useless for disambiguation). See `docs/spikes/2026-07-enrichment-source-spike.md`.
- **Per-field confidence** (`confidence.ts`, pure logic) — `field_confidence: { <field>: { level, evidence[] } }` on `EnrichmentResult`. Identity = cross-link agreement between independent sources (e.g. Discogs page links the SC that Brave found). SC is the root node; SC-derived fields inherit its identity confidence.
- **Image candidates from every source, tagged never excluded** — in graph mode Discogs images are always collected and confidence-tagged; the winner is re-ranked by confidence tier → SC avatar within tier → DETR score. Wikidata and Spotify were evaluated and rejected (see spike doc).
- **Persistence** (migration 036): `artists.image_candidates jsonb` (full tagged candidate set) + `artists.enrichment_confidence jsonb` (per-field `{ level, evidence[] }`). Applied on `--apply`; scoped runs merge only their own confidence keys (admin-confirmed values on other fields survive).
- **Backfill** (`--fields=image-candidates`): collects/scores/persists candidates only; never touches `image_url`, `enrichment_status`, or `enriched_at`. Field-scoped corroboration rule: Brave searches run only when the selected fields need them (or from scratch); within a covered field they run even if a value exists, for conflict detection.

### Rate limits & usage accounting

Brave Search: **1,000 queries/month** free tier (override via `BRAVE_MONTHLY_QUOTA`). Discogs: 60 req/min. SoundCloud scrape/oEmbed: ~1 req/sec. MusicBrainz: 1 req/sec + User-Agent. Bio research: 1 Brave query per artist (counts against monthly quota).

Every outbound client records real API consumption via `rate-limit.ts` (`recordUsage`, dry runs included — the calls happened); `enrich-artists.ts` flushes counts to the `api_usage` table (migration 037, service-role-only `increment_api_usage` RPC) and prints a **preflight Brave budget estimate** before each run. The admin dashboard's **API Budgets panel** reads `api_usage` via the `admin-usage` edge function: "≈N artists enrichable this month" (remaining Brave ÷ 3 calls/artist), monthly Brave bar (accent → white ≥70% → white-on-negative ≥90%), and per-vendor calls-today tiles. Keep the panel's constants in `src/components/admin/ApiBudgets.tsx` in sync with `BUDGETS` in `rate-limit.ts`.

### Enrichment workflow

```bash
# Standard enrichment (all fields)
npm run enrich -- --festival=<slug>

# Bio research + AI generation in one pass
npm run enrich -- --festival=<slug> --fields=bio

# Single artist (testing)
npm run enrich -- --artist="Speedy J" --fields=bio

# Refresh SoundCloud follower counts only (popularity ranking; followers change over time)
npm run enrich -- --festival=<slug> --fields=followers

# Apply reviewed JSON to DB (manual review mode)
npm run enrich -- --apply=enrichment-review/<slug>.json

# Run via admin background jobs (poll-jobs picks up jobs created in admin UI)
npm run enrich -- --poll-jobs
```

`--auto-apply` (used internally by `--poll-jobs`) skips interactive confirm and applies directly to DB.

### Bio generation

Bio research and AI generation run together when `--fields=bio` is used — no separate step needed.

**Research phase**: gathers `bio_research` JSONB with:
- `soundcloud_bio` — SC profile description
- `discogs_bio` — Discogs profile text (markup stripped)
- `festival_bio` — bio from ingest; `festival_bio_flagged: true` if it contains the festival brand name
- `web_sources[]` — up to 5 web pages with title, snippet, full content (5000 chars each)

**Generation phase**: `bio-generator.ts` calls the `claude` CLI (`--model sonnet`) with a constructed prompt and writes the result to `artists.bio_generated`. Runs **inline per artist** during the main loop — right after that artist's other sources are gathered — not as a separate second pass.

**Admin review**: admin compares Active Bio / Festival Bio / Generated Bio on the artist detail page and activates the preferred version. Festival bios flagged as containing the festival name show a warning in the UI — admin should not activate these cross-festival.

**Sources stored separately**:
- `bio_research` (JSONB) — full structured research data (AI generation input)
- `bio_sources` (JSONB array) — flat provenance list derived from `bio_research` at apply time (admin display)

### Festival bio flagging

At ingest time: bios containing the festival brand name are flagged with a SQL comment. During enrichment: when `--festival` is provided, `festival_bio_flagged` is computed using the same `bioContainsFestivalName()` helper. The flag is stored in `bio_research.festival_bio_flagged` and surfaced as a warning in the admin bio comparison UI.

### Env vars needed

```
BRAVE_API_KEY=...            # Brave Search API key (free, 1000 queries/month)
DISCOGS_CONSUMER_KEY=...     # Discogs consumer key (free)
DISCOGS_CONSUMER_SECRET=...  # Discogs consumer secret (free)
CLOUDFLARE_ACCOUNT_ID=...    # Cloudflare account ID — enables image scoring via Workers AI
CLOUDFLARE_API_TOKEN=...     # Cloudflare API token with Workers AI read permission
# Optional fallback (unused by default):
# GOOGLE_API_KEY=...         # Google Custom Search JSON API key
# GOOGLE_CSE_ID=...          # Custom Search Engine ID
```

No Anthropic API key needed — bio generation uses the local `claude` CLI (your Claude subscription).

### File structure

```
scripts/lib/enrichment/
  types.ts            # EnrichmentResult, BioResearch, BioSource, ArtistRow, etc.
  pipeline.ts         # orchestration per artist
  brave-search.ts     # Brave Search API (SC/IG search + bio research web search)
  google-search.ts    # Google Custom Search fallback (unused by default)
  soundcloud.ts       # profile scraping + oEmbed + location + bio extraction
  discogs.ts          # search + all_images + URLs + bio profile
  bandcamp.ts         # location scraping from Bandcamp pages
  image-scorer.ts     # Cloudflare DETR person detection for image candidate selection
  bio-generator.ts    # Claude CLI call for AI bio generation (--model sonnet)
  name-utils.ts       # query construction, URL parsing, combo detection
  review.ts           # review file + bio research chunks + apply + resume
scripts/prompts/
  generate-bios.md    # bio generation guidelines (reference — actual prompt built in bio-generator.ts)
```
