# Festival Pulse — Claude Context

## Product Vision

Festival Pulse is a **mobile-first PWA for electronic music festival attendees**. People use it on their phones at a live festival — often outdoors in sunlight, on bad networks, with limited battery. The product solves three things:

1. **Timetable** — browse the full festival schedule, works offline after first load
2. **"Going to"** — logged-in users mark which sets they plan to attend
3. **Ratings** — thumbs up/down on sets after attending (for personal memory)

The app is not social. It has no friend tracking, no aggregate rating display, no map, no notifications, no Spotify integration. Keep it fast and focused.

## Design Direction

**Dark, raw, industrial brutalist.** This is a techno festival app — it should feel like it belongs at a warehouse rave, not a startup dashboard.

- Near-black background (`#0A0A0A`)
- Monospace + condensed sans-serif typography (Space Mono + Barlow Condensed)
- High-contrast accent: orange-red (`#FF3B00`)
- **All secondary text and borders are white/light** — grey is invisible in outdoor sunlight
- Minimal decoration, functional density
- Mobile-first — everything is designed for a phone screen held at a festival

## Target User & Context

Someone at a multi-stage electronic music festival, phone in hand, trying to decide which stage to go to next. The app must:
- Load instantly on bad network (PWA cache-first)
- Be readable in bright sunlight (high contrast — this is why text-secondary is white, not grey)
- Work offline for browsing (timetable cached by service worker after first load)
- Require auth only for "going to" marks and ratings

---

## Tech Stack

| Layer | Library / Tool | Version |
|-------|---------------|---------|
| UI | React | 19 |
| Build | Vite | 8 |
| Types | TypeScript | 6 |
| Styling | Tailwind CSS v4 (CSS `@theme` — no tailwind.config.js) | 4 |
| Routing | React Router | v7 |
| Data fetching | TanStack React Query | v5 |
| Backend | Supabase (Postgres + Auth + RLS) | — |
| PWA | vite-plugin-pwa (Workbox generateSW) | — |
| Deploy | Cloudflare Pages via Workers static assets | — |

---

## Project Structure

```
src/
  App.tsx                          # Route definitions
  index.css                        # Tailwind @theme color tokens
  types/database.ts                # All Supabase table types
  lib/
    supabase.ts                    # Supabase client (uses import.meta.env)
    dates.ts                       # getDays(), formatDayLabel()
  hooks/
    useFestivalData.ts             # useFestivals, useFestival, useStages, useSets
    useUserPlan.ts                 # Going/not-going toggle state
  pages/
    FestivalListPage.tsx           # Home — lists all festivals (upcoming/past)
    SchedulePage.tsx               # Timetable view (or LineupView if no timetable)
    MySchedulePage.tsx             # User's saved sets
    LoginPage.tsx / SignUpPage.tsx
  components/
    layout/Header.tsx              # Nav with festival-aware breadcrumb
    layout/Layout.tsx
    schedule/
      DayToggle.tsx                # Day tab bar — labels generated dynamically
      StageFilter.tsx              # Stage filter chips
      SetCard.tsx                  # Individual set card (null-safe for lineup-only)
      LineupView.tsx               # Alphabetical list for festivals with no timetable
    common/OfflineNotice.tsx
    AuthGuard.tsx
  contexts/AuthContext.tsx
scripts/
  ingest.ts                        # Ingest pipeline: scrape → diff → SQL
  parse-artists.ts                 # Artist normalization (standalone fallback)
  lib/
    artist-parser.ts               # Shared artist name parsing logic
  scrapers/
    types.ts                       # ScrapedData intermediate JSON schema
    base.ts                        # Playwright/cheerio helpers, time parsing
    index.ts                       # Adapter registry (URL pattern → scraper)
    awakenings.ts                  # Awakenings adapter (all their festivals)
supabase/
  migrations/                      # Sequential SQL files — run in Supabase SQL Editor
```

---

## Routes

```
/                                  → FestivalListPage (home, lists all festivals)
/festivals/:slug/schedule          → SchedulePage
/festivals/:slug/my-schedule       → MySchedulePage (auth-guarded)
/login                             → LoginPage
/signup                            → SignUpPage
```

---

## Database Schema

### Core tables (001_schema.sql)

```sql
festivals   id, name, slug, location, start_date, end_date, created_at
stages      id, festival_id, name, sort_order
sets        id, festival_id, stage_id (nullable), artist_name, day, 
            start_time (nullable), end_time (nullable), is_live, awakenings_url
user_plans  id, user_id, set_id, created_at          -- "going to" marks
user_ratings id, user_id, set_id, rating(-1|1), created_at
```

### Added in migrations

- `003_multi_festival.sql` — makes `start_time`, `end_time`, `stage_id` nullable on `sets`; adds `timetable_announced boolean` to `festivals`
- `005_artist_normalization.sql` — adds:

```sql
artists     id, name, sort_name (unique, lowercase), is_collective, bio, source_url, created_at
set_artists id, set_id, artist_id, role (solo|b2b|f2f|collab|vs|member), billing_order
```

- `006_ingest_support.sql` — adds `bio` and `source_url` to `artists`; unique constraints on `stages(festival_id, name)` and `sets(festival_id, artist_name, day)` for upsert support

### RLS summary

- `festivals`, `stages`, `sets`, `artists`, `set_artists` — public read, no write
- `user_plans`, `user_ratings` — users own their rows (select/insert/delete own)

### Supabase project

- URL and anon key: in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## Festivals in DB

| Festival | Slug | Dates | timetable_announced |
|----------|------|-------|---------------------|
| Awakenings Festival 2026 | `awakenings-festival-2026` | Jul 10–12 2026 | true |
| Awakenings Upclose 2026 | `awakenings-upclose-2026` | May 16–17 2026 | true |
| 909 Festival 2026 | `909-2026` | Jun 6–7 2026 | false (lineup only) |
| Verknipt Festival 2026 | `verknipt-2026` | Jun 6–7 2026 | true |
| Dekmantel 2026 | `dekmantel-2026` | Jul 29–Aug 2 2026 | true |

`SchedulePage` automatically shows `LineupView` when `timetable_announced === false`.

---

## Key Patterns

### Adding a new festival (automated ingest)

For festivals with a scraper adapter (currently: Awakenings, Dekmantel):

```bash
npm run ingest -- --url=<festival-event-url>              # scrape, diff, generate SQL
npm run ingest -- --url=<url> --dry-run                   # preview diff only
npm run ingest -- --url=<url> --skip-bios                 # skip fetching artist bios
```

The ingest script: scrapes the page → compares against current DB state → shows a diff preview → generates a complete upsert SQL file (festival, stages, sets, artists, set_artists) at `supabase/migrations/`. Run the SQL in Supabase SQL Editor.

For festivals without an adapter, extract data as JSON matching the `ScrapedData` schema (see `scripts/scrapers/types.ts`) and use:

```bash
npm run ingest -- --json=scraped/some-festival.json
```

### Adding a new festival (manual fallback)

1. Write `supabase/migrations/00X_festivalname.sql` — insert festival, stages, sets
2. Run in Supabase SQL Editor
3. Run `npm run parse-artists -- --festival=the-slug` to populate artists + set_artists

### Lineup-only festival (no timetable yet)

Set `timetable_announced: false` in the festival row. Omit stage, start_time, end_time from sets (leave NULL). `SchedulePage` renders `LineupView` automatically.

### Date utilities (`src/lib/dates.ts`)

- `getDays(startDate, endDate)` — returns array of `YYYY-MM-DD` strings
- `formatDayLabel(dateStr)` — returns `"SAT 6 JUN"` style label
- `isAfterMidnight(time)` — returns true if time is before `AFTER_MIDNIGHT_CUTOFF` (07:00)
- `toSortableTime(time)` — adds 24h to after-midnight times so they sort after 23:59
- **Important:** Always use noon (`T12:00:00`) when constructing Date objects from date strings to avoid UTC timezone shift bugs

### Cross-midnight / after-party sets

The `day` field on sets stores the **festival day** (the day the programming block belongs to), not the calendar day. After-midnight sets (e.g., camping after parties at 00:30–05:00) are stored under the previous festival day.

- **Cutoff:** `AFTER_MIDNIGHT_CUTOFF = '07:00'` in `src/lib/dates.ts`. Times before 07:00 are treated as next calendar day for time computation.
- **Now Playing** (`useNowPlaying.ts`): `toFestivalDate()` adds 1 day when time < cutoff, so "Friday 00:30" correctly resolves to Saturday 00:30.
- **Sorting** (`SchedulePage.tsx`): `toSortableTime()` maps "00:30" → "24:30" so after-midnight sets sort after 23:59.
- **UI divider**: An "AFTER MIDNIGHT" divider appears between the last pre-midnight set and the first after-midnight set on each day.

### Dynamic day labels

`DayToggle` generates labels dynamically from date strings via `formatDayLabel()`. There is no hardcoded `DAY_LABELS` map anywhere.

---

## Design System

Colors defined in `src/index.css` via Tailwind v4 `@theme`:

```css
--color-bg:             #0A0A0A   /* near-black background */
--color-surface:        #141414   /* card surfaces */
--color-text-primary:   #FFFFFF
--color-text-secondary: #FFFFFF   /* was #888888 — changed for outdoor readability */
--color-border:         #444444   /* was #2A2A2A — changed for outdoor readability */
--color-accent:         #FF3B00   /* orange-red accent */
```

Used as Tailwind classes: `bg-bg`, `text-text-primary`, `text-text-secondary`, `border-border`, `bg-accent`, etc.

---

## Environment Variables

`.env.local` (gitignored via `*.local` in `.gitignore`):

```
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service role key — Project Settings → API → Reveal>
```

`SUPABASE_SERVICE_ROLE_KEY` is needed for `npm run ingest` and `npm run parse-artists` — never used in the browser app.

---

## NPM Scripts

```bash
npm run dev             # Local dev server
npm run build           # tsc + vite build → dist/
npm run deploy          # build + deploy to Cloudflare
npm run ingest -- --url=<url>               # Scrape festival → diff → generate SQL
npm run ingest -- --url=<url> --dry-run     # Preview diff only
npm run ingest -- --url=<url> --skip-bios   # Skip artist bio fetching
npm run ingest -- --json=<path>             # Ingest from pre-scraped JSON
npm run parse-artists   # Populate artists/set_artists from sets.artist_name
npm run parse-artists -- --festival=slug    # One festival only
npm run parse-artists -- --dry-run          # Preview, no DB writes
```

---

## Deployment

**Cloudflare Pages** via GitHub auto-deploy (push to `main` → build triggers).

- Repo: `maxbuildshq/festival-pulse` on GitHub
- Build command: `npm run build`
- Output directory: `dist/`
- `wrangler.toml` uses `[assets]` block (Workers static assets approach — NOT `pages_build_output_dir`)

```toml
name = "festival-pulse"
compatibility_date = "2026-05-24"

[assets]
directory = "./dist"
```

**Critical:** The deploy command in package.json is `npx wrangler deploy` (not `wrangler pages deploy`). Using `pages deploy` causes auth errors; using `[assets]` in wrangler.toml with `pages deploy` causes a "does not support assets" error.

Cloudflare env vars needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (set in Cloudflare Pages dashboard — do NOT add `SUPABASE_SERVICE_ROLE_KEY` there).

---

## Artist Normalization

Parsing logic lives in `scripts/lib/artist-parser.ts` (shared by both `ingest.ts` and `parse-artists.ts`).

Pre-processing: strips `(live)`, trailing `Live`, and mid-name `Live` before qualifiers like `(` or `w/`.

Parsing rules (priority order):
1. Colon format → `"LSD: Luke Slater, Steve Bicknell and Function"`
2. Parenthetical with `,` or `&` → `"Collabs 3000 (Chris Liebing & Speedy J)"`
3. ` w/ ` → `"STOOR w/ Aurora Halal, Azu Tiwaline"` (collective + members)
4. ` featuring ` (case-insensitive) → `"Underground Resistance featuring Saul Williams"`
5. ` F2F ` (case-insensitive)
6. ` B2B ` (case-insensitive)
7. ` vs `
8. ` x ` (case-sensitive, space-x-space — won't match "DAX J")
9. ` & `
10. Solo

The `ingest.ts` script runs this parsing inline and includes artist + set_artist upserts in the generated SQL. The standalone `parse-artists.ts` remains as a fallback for re-parsing all artists globally.

---

## Ingest Pipeline

### Architecture

```
Scraper adapters (per-festival)  →  ScrapedData JSON  →  ingest.ts  →  SQL migration
                                                              ↕
                                                     Supabase (current state)
```

### Scraper adapters

Each adapter is a function `(url: string) => Promise<ScrapedData>` in `scripts/scrapers/`. The adapter registry in `scripts/scrapers/index.ts` maps URL patterns to adapters.

Current adapters:
- **Awakenings** (`awakenings.com`) — works for all Awakenings events (Upclose, Festival, ADE, Easter, Monegros)
- **Dekmantel** (`dekmantelfestival.com`) — extracts `__NUXT__` payload via Playwright; maps ITC venues and Bos day/dawn to stages

### Adding a new adapter

1. Create `scripts/scrapers/<name>.ts` exporting a `ScraperAdapter` function
2. Register it in `scripts/scrapers/index.ts` with a URL pattern
3. The adapter must return `ScrapedData` (see `scripts/scrapers/types.ts`)

### LLM extraction (no adapter)

For one-off festivals without an adapter, extract data in Claude Code as JSON matching the `ScrapedData` schema, save to a file, and use `npm run ingest -- --json=<path>`.

### Artist bios

- Bio enrichment is optional — adapters can populate the `artists` array with bios from festival artist pages
- Bios use "keep longest" logic: a longer bio from a new source replaces a shorter existing one
- `--skip-bios` flag skips fetching artist pages (faster scraping)

---

## Planned / Not Yet Built

- Artist detail page (`/artists/:slug`) showing all sets across festivals
- `useArtistSets(artistId)` hook
- Clickable artist names in SetCard
- Additional scraper adapters (Verknipt, etc.)
