# 012 — Retire `sets.is_live`, `performance_type` is the single source of truth

**Status**: Accepted (2026-07-23)

## Context

A set's performance mode was represented two ways. `sets.is_live` (boolean) shipped in the
original schema (001) and is what scrapers naturally detect ("is this set tagged live?").
Migration 040 later added `sets.performance_type` (`'live' | 'hybrid' | null`) because `is_live`
can't express **hybrid** (DJ + live composition); the UI reads `performance_type` for its badge.

That left two overlapping columns. The ingest pipeline wrote only `is_live`, so every new
festival migration needed a manual `UPDATE … SET performance_type = 'live' WHERE is_live` backfill
to make the badge appear — a band-aid that had to be remembered each time and was easy to forget
(a new festival would silently show no Live badges).

## Decision

**`performance_type` is the single source of truth for a set's mode. `is_live` is retired —
column dropped (migration 041), and removed from the entire ingest pipeline and types.**

- `ScrapedSet.performance_type: 'live' | 'hybrid' | null` is what scrapers emit; `is_live` is gone
  from the type.
- `generateSql` writes `performance_type` directly on every insert/update — **no backfill**.
- Producers convert at the source: Awakenings/Dekmantel/poster-vision map their internal live
  boolean to `performance_type`; the LLM extractor's schema asks for `performance_type` and
  `validateScrapedData` defensively maps any stray legacy `is_live` a model emits (so nothing is
  lost). `poster-vision`'s internal `VisionBlock.is_live` stays — it's the vision model's raw
  live-tag read, not the DB column.

## Why it was safe to drop

Verified before the drop: nothing in `src/` or edge functions read `is_live`; no index, view, or
constraint depended on it; all 45 existing live sets were already mirrored to `performance_type`
(0 un-mirrored), and the drop migration re-runs the mirror defensively before `DROP COLUMN`.

## Consequences

- New festivals get their Live/Hybrid badge with zero extra steps. Do **not** add a
  `performance_type` backfill to new migrations (migrations ≤040 have one only for historical
  reasons).
- Hybrid is now expressible end-to-end (previously only recoverable by a manual `UPDATE`, e.g. the
  three Dekmantel 2026 hybrids in migration 040).
- Pipeline/schema details live in [scripts/AGENTS.md](../../scripts/AGENTS.md) (“Performance type”)
  and [supabase/AGENTS.md](../../supabase/AGENTS.md).
