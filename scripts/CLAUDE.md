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

# Artist normalization
npm run parse-artists                                  # re-parse all artists globally
npm run parse-artists -- --festival=<slug>             # one festival only
npm run parse-artists -- --dry-run                     # preview, no DB writes

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
npm run enrich -- --apply=enrichment-review/X.json     # apply reviewed file to DB
```

## Adding a Festival (automated ingest)

For festivals with a scraper adapter (Awakenings, Dekmantel):

```bash
npm run ingest -- --url=<festival-event-url>
```

Scrapes → diffs against DB → shows preview → generates a complete upsert SQL at `supabase/migrations/`. Run the SQL in Supabase SQL Editor.

For festivals without an adapter, extract as JSON matching the `ScrapedData` schema (see `scripts/scrapers/types.ts`) and use:

```bash
npm run ingest -- --json=scraped/some-festival.json
```

**LLM extraction workflow:** For one-offs, extract data in Claude Code as JSON matching `ScrapedData`, save to a file, then run `--json`.

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
- **Dekmantel** (`dekmantelfestival.com`) — extracts `__NUXT__` payload via Playwright; maps ITC venues and Bos day/dawn to stages

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

## Artist Normalization

Parsing in `scripts/lib/artist-parser.ts` (shared by `ingest.ts` and `parse-artists.ts`).

Pre-processing: strips `(live)`, trailing `Live`, and mid-name `Live` before qualifiers like `(` or `w/`.

Parsing rules (priority order):
1. Colon format: `"LSD: Luke Slater, Steve Bicknell and Function"`
2. Parenthetical with `,` or `&`: `"Collabs 3000 (Chris Liebing & Speedy J)"`
3. `w/`: `"STOOR w/ Aurora Halal, Azu Tiwaline"` (collective + members)
4. `featuring` (case-insensitive)
5. `F2F` (case-insensitive)
6. `B2B` (case-insensitive)
7. `vs`
8. `x` (case-sensitive, space-x-space — won't match "DAX J")
9. `&`
10. Solo

## Artist Enrichment

Pipeline in `scripts/lib/enrichment/`. Populates `artists.image_url`, `instagram_url`, `soundcloud_url`, `soundcloud_embed_url`, `bandcamp_url`.

### Pipeline flow per artist

1. **Brave Search** → find SoundCloud profile URL (`"<name>" dj music site:soundcloud.com`)
2. **Brave Search** → (if IG still missing) find Instagram (`"<name>" dj music site:instagram.com`)
3. **Discogs** → supplementary image, Bandcamp URL, SC/IG fallback
4. **SoundCloud profile scrape** → extract image, Instagram cross-ref from bio/links; set profile URL as embed
5. **SoundCloud oEmbed** → validate embed URL

Skips combo/temporary artist entries (B2B placeholders with `is_collective: false` + `&`/`b2b`/`vs` in sort_name).

### Rate limits

Brave Search: **2,000 queries/month** free tier (no credit card required). Discogs: 60 req/min. SoundCloud scrape/oEmbed: throttled to ~1 req/sec. Google Custom Search kept as fallback (`google-search.ts`) but unused by default.

### Review workflow

1. `npm run enrich -- --festival=<slug>` → writes `enrichment-review/<slug>.json`
2. Human reviews/edits the JSON (fix wrong matches, remove false positives)
3. `npm run enrich -- --apply=enrichment-review/<slug>.json` → writes to DB

### Env vars needed

```
BRAVE_API_KEY=...            # Brave Search API key (free, 2000 queries/month)
DISCOGS_CONSUMER_KEY=...     # Discogs consumer key (free)
DISCOGS_CONSUMER_SECRET=...  # Discogs consumer secret (free)
# Optional fallback (unused by default):
# GOOGLE_API_KEY=...         # Google Custom Search JSON API key
# GOOGLE_CSE_ID=...          # Custom Search Engine ID
```

### File structure

```
scripts/lib/enrichment/
  types.ts          # EnrichmentResult, ReviewFile, ProgressFile, ArtistRow
  pipeline.ts       # orchestration per artist (source-agnostic)
  brave-search.ts   # Brave Search API wrapper (primary web search)
  google-search.ts  # Google Custom Search API wrapper (fallback, unused by default)
  soundcloud.ts     # profile scraping + oEmbed validation
  discogs.ts        # search + images + URLs (supplementary)
  name-utils.ts     # query construction, URL parsing, combo detection
  review.ts         # JSON review file generation + apply + resume
```
