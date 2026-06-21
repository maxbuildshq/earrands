-- Admin support: bio versioning, notification log, enrichment job queue

-- Bio versioning: store AI-generated bio separately from display bio
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio_generated text;

-- Notification audit log (batch-level, not per-recipient)
CREATE TABLE notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  festival_id uuid REFERENCES festivals(id),
  recipient_count int NOT NULL DEFAULT 0,
  sent_at timestamptz DEFAULT now(),
  success boolean NOT NULL DEFAULT true,
  error text
);
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Background job queue (enrichment, parse-artists, bio research)
CREATE TABLE enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'enrich',
  status text NOT NULL DEFAULT 'pending',
  festival_slug text,
  artist_sort_names text[],
  fields text[],
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  result_summary jsonb,
  error text
);
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notification_log_festival ON notification_log(festival_id);
CREATE INDEX idx_notification_log_sent ON notification_log(sent_at);
CREATE INDEX idx_enrichment_jobs_status ON enrichment_jobs(status);
