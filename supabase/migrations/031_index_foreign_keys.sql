-- Add covering indexes for unindexed foreign keys flagged by Supabase advisor.

CREATE INDEX IF NOT EXISTS idx_festival_requests_matched_festival
  ON festival_requests (matched_festival_id);

CREATE INDEX IF NOT EXISTS idx_shared_schedules_festival
  ON shared_schedules (festival_id);
