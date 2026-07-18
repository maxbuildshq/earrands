# supabase/ — Database Schema & Migrations

## Schema Overview

### Core tables (001_schema.sql)

```sql
festivals    id, name, slug, location, start_date, end_date, timetable_announced, published (default false), created_at
stages       id, festival_id, name, sort_order
sets         id, festival_id, stage_id (nullable), artist_name, day,
             start_time (nullable), end_time (nullable), is_live, awakenings_url
user_plans   id, user_id, set_id, created_at          -- "going to" marks
user_ratings id, user_id, set_id, rating(-1|1), created_at
```

### Key migrations

- `003_multi_festival.sql` — makes `start_time`, `end_time`, `stage_id` nullable on `sets`; adds `timetable_announced boolean` to `festivals`
- `005_artist_normalization.sql`:

```sql
artists     id, name, sort_name (unique, lowercase), is_collective, bio, source_url, created_at
set_artists id, set_id, artist_id, role (solo|b2b|f2f|collab|vs|member), billing_order
```

- `006_ingest_support.sql` — adds `bio`, `source_url` to `artists`; unique constraints on `stages(festival_id, name)` and `sets(festival_id, artist_name, day)` for upsert support
- `014_requests_follows.sql`:

```sql
festival_follows   id, user_id, festival_id, notified_at (nullable), created_at
                   unique(user_id, festival_id)
festival_requests  id, user_id, raw_name, region (nullable), notified_at (nullable), created_at
```

- `015_festival_requests_notified_at.sql` — adds `notified_at` to `festival_requests` (dedup pattern, same as `festival_follows`)
- `016_artist_enrichment.sql` — adds enrichment columns to `artists` (`image_url`, `instagram_url`, `soundcloud_url`, `soundcloud_embed_url`, `bandcamp_url`, `discogs_id`, `enriched_at`) and `published boolean` to `festivals`
- `029_welcome_email.sql` — `welcome_emails` dedup table (RLS on, no policies — service-role only) + pg_net trigger on `auth.users` that calls the `welcome-email` edge function on email confirmation. Needs a vault secret `welcome_email_secret` matching the edge function's `WELCOME_EMAIL_SECRET`; function also needs `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL` secrets.
- `036_image_candidates.sql` — adds `image_candidates jsonb` (full tagged candidate set) and `enrichment_confidence jsonb` (per-field `{ level, evidence[] }`, ADR 011) to `artists`; both nullable/additive
- `037_api_usage.sql` — `api_usage` counter table (vendor, day, count; RLS on, no policies — service-role only) + security-definer `increment_api_usage(v, n)` RPC; written by enrichment scripts, read by the admin-usage edge function for the dashboard API-budgets panel
- `038_parse_suggestions.sql` — `parse_suggestions` table (Phase 2b parsing arbiter; RLS on, no policies — service-role only): LLM-proposed parse corrections per `(festival_id, raw_name)` with confidence + pending/accepted/dismissed status; written by `parse-artists --arbiter`, reviewed via the admin-festivals edge function, applied to `set_artists` by the next arbiter run

## RLS Summary

- `festivals`, `stages`, `sets`, `artists`, `set_artists` — public read, no write
- `user_plans`, `user_ratings`, `festival_follows`, `festival_requests` — users own their rows (select/insert own; delete own for follows)

## Supabase Project

URL and anon key: `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## useSets Join Query

The `useSets` hook joins through `set_artists → artists` to fetch bios:

```
.select('*, stages(name, sort_order), set_artists(billing_order, role, artists(name, bio, source_url, is_collective, image_url, instagram_url, soundcloud_url, soundcloud_embed_url, bandcamp_url))')
```

Service worker caches `artists` and `set_artists` tables for offline access.

## Festival Display Logic

`SchedulePage` automatically shows `LineupView` when `timetable_announced === false`. Set it to `true` via SQL when a timetable drops, then run `npm run notify -- --festival=<slug>`.

Bio enrichment is optional — adapters can populate `artists` with bios from festival artist pages. Bios use "keep longest" logic: a longer bio from a new scrape replaces a shorter existing one.
