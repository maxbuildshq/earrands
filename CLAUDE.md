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
  parse-artists.ts                 # Artist normalization script (run manually)
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
artists     id, name, sort_name (unique, lowercase), is_collective, created_at
set_artists id, set_id, artist_id, role (solo|b2b|f2f|collab|vs|member), billing_order
```

### RLS summary

- `festivals`, `stages`, `sets`, `artists`, `set_artists` — public read, no write
- `user_plans`, `user_ratings` — users own their rows (select/insert/delete own)

### Supabase project

- URL and anon key: in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## Festivals in DB

| Festival | Slug | Dates | timetable_announced |
|----------|------|-------|---------------------|
| Awakenings Upclose 2026 | `awakenings-upclose-2026` | May 16–17 2026 | true |
| 909 Festival 2026 | `909-2026` | Jun 6–7 2026 | false (lineup only) |
| Verknipt Festival 2026 | `verknipt-2026` | Jun 6–7 2026 | true |

`SchedulePage` automatically shows `LineupView` when `timetable_announced === false`.

---

## Key Patterns

### Adding a new festival

1. Write `supabase/migrations/00X_festivalname.sql` — insert festival, stages, sets
2. Run in Supabase SQL Editor
3. Run `npm run parse-artists -- --festival=the-slug` to populate artists + set_artists

### Lineup-only festival (no timetable yet)

Set `timetable_announced: false` in the festival row. Omit stage, start_time, end_time from sets (leave NULL). `SchedulePage` renders `LineupView` automatically.

### Date utilities (`src/lib/dates.ts`)

- `getDays(startDate, endDate)` — returns array of `YYYY-MM-DD` strings
- `formatDayLabel(dateStr)` — returns `"SAT 6 JUN"` style label
- **Important:** Always use noon (`T12:00:00`) when constructing Date objects from date strings to avoid UTC timezone shift bugs

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

`SUPABASE_SERVICE_ROLE_KEY` is only needed for `npm run parse-artists` — never used in the browser app.

---

## NPM Scripts

```bash
npm run dev             # Local dev server
npm run build           # tsc + vite build → dist/
npm run deploy          # build + deploy to Cloudflare
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

The `scripts/parse-artists.ts` script splits multi-artist `sets.artist_name` strings into individual `artists` records linked via `set_artists`. Safe to re-run (idempotent — uses ON CONFLICT DO NOTHING).

Parsing rules (priority order):
1. Colon format → `"LSD: Luke Slater, Steve Bicknell and Function"`
2. Parenthetical with `,` or `&` → `"Collabs 3000 (Chris Liebing & Speedy J)"`
3. ` F2F ` (case-insensitive)
4. ` B2B ` (case-insensitive)
5. ` vs `
6. ` x ` (case-sensitive, space-x-space — won't match "DAX J")
7. ` & `
8. Solo

---

## Planned / Not Yet Built

- Artist detail page (`/artists/:slug`) showing all sets across festivals
- `useArtistSets(artistId)` hook
- Clickable artist names in SetCard
- Dekmantel festival data (user to provide screenshots)
