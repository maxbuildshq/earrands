-- Support for the ingest pipeline: artist enrichment fields + unique constraints for upserts.

-- 1. Artist enrichment
alter table artists add column if not exists bio text;
alter table artists add column if not exists source_url text;

-- 2. Unique constraints for upsert operations
-- Stages: one stage name per festival
create unique index if not exists idx_stages_festival_name on stages(festival_id, name);

-- Sets: one time slot per stage per day (for timetable festivals)
create unique index if not exists idx_sets_stage_day_time on sets(festival_id, stage_id, day, start_time);
