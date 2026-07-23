-- Retire the legacy sets.is_live boolean. performance_type (migration 040) is now the single
-- source of truth for a set's mode, written directly by the ingest pipeline. See ADR 012.
--
-- Safe to drop: nothing in src/, edge functions, indexes, or views references is_live, and all
-- existing live sets are already mirrored to performance_type. The backfill below is a defensive
-- no-op that guarantees no live flag is lost even if a set slipped through unmirrored.

UPDATE sets
SET performance_type = 'live'
WHERE is_live = true AND performance_type IS NULL;

ALTER TABLE sets DROP COLUMN is_live;
