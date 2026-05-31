-- Add notified_at to festival_requests so notify.ts can deduplicate sends.
-- Same pattern as festival_follows.notified_at — set by the service role in scripts/notify.ts.
alter table festival_requests add column notified_at timestamptz;
