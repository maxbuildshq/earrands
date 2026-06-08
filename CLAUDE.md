# earrands — Claude Context

## Product & Context

Mobile-first PWA for electronic music festival attendees — phones at live festivals, outdoors in sunlight, dark warehouses, bad networks, limited battery. Three things: **Timetable**, **"Going to"** marks, **Ratings**. Not social (no friends, no GPS, no push notifications). Next step: iOS app.

**Competitor: Resident Advisor (RA).** Do not use RA as a data source, do not link to RA, do not recommend RA in any feature.

Every UI change must hold up against: bad network (PWA cache-first), bright sunlight (high contrast), offline browsing (service worker), auth required only for marks and ratings.

## Brand

Voice, positioning, and copy rules: [`docs/brand.md`](docs/brand.md). Read before writing any user-facing copy. The one test: *would this feel out of place on a flyer for a night at Shelter?*

## Design Direction

Dark, raw, industrial brutalist — techno festival, not a startup dashboard.

- Near-black background (`#0A0A0A`), acid lime accent (`#CCFF00`)
- Space Mono + Barlow Condensed typography
- **`text-secondary` = `#FFFFFF` white, not grey** — grey is invisible outdoors in sunlight ([001](docs/decisions/001-outdoor-contrast.md))
- Mobile-first, functional density, minimal decoration

## Tech Stack

| Layer | Library / Tool | Version |
|---|---|---|
| UI | React | 19 |
| Build | Vite | 8 |
| Types | TypeScript | 6 |
| Styling | Tailwind CSS v4 (CSS `@theme` — no tailwind.config.js) | 4 |
| Routing | React Router | v7 |
| Data fetching | TanStack React Query | v5 |
| Backend | Supabase (Postgres + Auth + RLS) | — |
| PWA | vite-plugin-pwa (Workbox generateSW) | — |
| Deploy | Cloudflare Pages via Workers static assets | — |

## Project Structure

```
src/
  App.tsx
  index.css                  # Tailwind @theme color tokens
  types/database.ts          # all Supabase table types
  lib/
    dates.ts                 # getDays(), formatDayLabel(), isAfterMidnight(), toSortableTime()
    shareImage.ts            # canvas 1080×1920 renderer — drawSchedule(), TEMPLATES
  hooks/                     # useFestivalData, useUserPlan, useFestivalFollows, useFestivalRequests
  pages/                     # FestivalListPage, SchedulePage, MySchedulePage, Login/SignUp
  components/
    layout/                  # Header (FeedbackButton portalled here), Layout
    schedule/                # DayToggle, StageFilter, SetCard, SetSheet, LineupView
    actions/                 # GoingToggle, RatingButtons
    common/                  # BottomSheet, AuthPrompt, OfflineNotice
    festival/                # FollowButton, RequestFestivalCTA, RequestFestivalSheet, ShareScheduleSheet
    feedback/FeedbackButton.tsx
  contexts/AuthContext.tsx   # signUp() accepts { marketingConsent }
scripts/                     # ingest, notify, parse-artists (see scripts/CLAUDE.md)
supabase/
  migrations/                # sequential SQL files (see supabase/CLAUDE.md for schema)
```

## Key Decisions

Full rationale in `docs/decisions/`. These cause bugs if forgotten:

- `text-secondary` = white, not grey — outdoor sunlight readability ([001](docs/decisions/001-outdoor-contrast.md))
- Date from string: always `T12:00:00` to avoid UTC shift bugs ([002](docs/decisions/002-date-timezone.md))
- `day` field = festival day, not calendar day; after-midnight cutoff = `07:00` ([003](docs/decisions/003-cross-midnight-sets.md))
- `FeedbackButton` must portal to `document.body` — header `backdrop-filter` clips `fixed` children ([004](docs/decisions/004-feedback-portal.md))
- Combo bio vs individual bio display — `resolveArtists()` in `SetSheet.tsx` ([005](docs/decisions/005-combo-bio.md))
- Deploy: `npx wrangler deploy`, NOT `wrangler pages deploy` ([006](docs/decisions/006-wrangler-deploy.md))
- Marketing consent checkbox: unchecked by default (GDPR) ([007](docs/decisions/007-marketing-consent.md))

When you discover a new non-obvious constraint, add a bullet here and create `docs/decisions/NNN-title.md`. When a pattern in `scripts/` or `supabase/` changes, update the relevant subdirectory CLAUDE.md.

## Key Patterns

### BottomSheet + AuthPrompt

`BottomSheet` (`src/components/common/BottomSheet.tsx`) is the shell for all sheet-style UI — backdrop, slide-up animation, swipe-to-dismiss, Escape key, body scroll lock. Use it for any new sheet.

For auth-gated actions triggered by anonymous users: show `AuthPrompt` inside a `BottomSheet`. `AuthPrompt` links to `/signup` and `/login` with `state={{ returnTo: location.pathname }}`.

### SetCard → SetSheet

Tapping a `SetCard` opens a `SetSheet` (artist bios + action buttons). Going/Rating buttons on the card use `stopPropagation` so they don't open the sheet. Sheet layout: set info → action buttons → scrollable bio content.

### New user-action hooks

`useFestivalFollows` and `useFestivalRequests` mirror `useUserPlan`: React Query + optimistic update + PostHog event. Follow that pattern for any new user-action hook.

### Lineup-only festivals

Set `timetable_announced: false` on the festival row. `SchedulePage` renders `LineupView` automatically. When the timetable drops, flip to `true` via SQL and run `npm run notify -- --festival=<slug>`.

### Festival publishing

`festivals.published` (boolean, default `false`) controls visibility to end users. New festivals start unpublished (staging). The festival list query filters on `published = true`. Direct slug access still works (for QA). Workflow: add festival data → enrich artists → QA → set `published = true` → notify followers.

### Artist enrichment

`SetSheet` displays artist images, social links (Instagram, SoundCloud, Bandcamp), and an embedded SoundCloud player — all gated on data availability per artist. The enrichment pipeline populates `artists.image_url`, `instagram_url`, `soundcloud_url`, `soundcloud_embed_url`, `bandcamp_url`.

```bash
npm run enrich -- --festival=<slug>               # enrich artists for one festival
npm run enrich -- --artist="Speedy J"             # single artist (testing)
npm run enrich -- --dry-run                       # preview only
npm run enrich -- --limit=30                      # pace Google quota (100/day free)
npm run enrich -- --resume                        # continue from saved progress
npm run enrich -- --fields=bandcamp               # only fetch specific fields
npm run enrich -- --apply=enrichment-review/X.json  # apply reviewed file to DB
```

Pipeline: Brave Search → Discogs (supplementary) → SoundCloud profile scrape → oEmbed validation. Outputs a review JSON at `enrichment-review/<slug>.json` for human verification before DB write. See `scripts/CLAUDE.md` for full details.

## Environment

Secrets in `.env.local` (gitignored). Critical: `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never reference it in any `src/` file.

## Deployment

Cloudflare Pages via `main` branch auto-deploy (repo: `maxbuildshq/earrands`). Build: `npm run build` → `dist/`. See [006](docs/decisions/006-wrangler-deploy.md) for the wrangler deploy gotcha.

Cloudflare env vars needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to the Cloudflare dashboard.

## Working Principles

### 1. Think Before Coding

State assumptions explicitly before implementing. If multiple interpretations of a request exist, present them — don't pick silently. If a simpler approach would serve the goal better, say so. If something is unclear, stop and ask.

For new user-facing features: briefly frame the problem first — who has this problem, and what changes for them — before proposing code.

### 2. Simplicity First

Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No error handling for impossible scenarios. If it could be 50 lines, don't write 200.

### 3. Surgical Changes

Touch only what the request requires. Don't improve, refactor, or reformat adjacent code. Match existing style even if you'd do it differently. If you notice unrelated dead code, mention it — don't delete it. Remove only imports/variables that your own changes made unused.

### 4. Goal-Driven Execution

Transform tasks into verifiable goals, scaled to the change:

| Change type | Success criteria |
|---|---|
| Typo / one-liner / obvious bug fix | Just do it |
| Small feature or refactor | Tests pass; behavior matches intent |
| New user-facing feature | Problem framed; PostHog event shipped; tests pass |
| Architecture / schema / public behavior | Tradeoff named; ADR if hard to reverse; tests pass |

**Instrument before you ship:** for any new user-facing feature, add a PostHog event in the same change — never "we'll add analytics later."

## Testing

```bash
npm run test          # run all tests once (Vitest)
npm run test:watch    # watch mode
```

Tests live alongside source as `*.test.ts`. Keep the suite current alongside changes:
- New pure logic function → write a test for it in the same change
- Changing existing logic → update affected tests
- Fixing a bug → write a failing test first, then fix it

React component tests are not set up — skip for UI components.
