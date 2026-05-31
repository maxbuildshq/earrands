# scripts/ — Ingest, Notify, Artist Parsing

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
