-- Drop the unique index on (festival_id, stage_id, day, start_time).
-- Multiple acts can share the same time slot at multi-stage venues
-- (e.g. Dekmantel's "Amsterdamse Bos — By Day" covers several physical stages).
-- Set matching is now handled in TypeScript by the ingest pipeline, not via ON CONFLICT.
DROP INDEX IF EXISTS idx_sets_stage_day_time;
