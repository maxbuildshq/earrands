-- Transient search keywords passed from admin UI to enrichment jobs.
-- Appended to Brave Search queries to improve hit rate for ambiguous artist names.
-- Not stored on the artist — only lives on the job row for the duration of the run.
ALTER TABLE enrichment_jobs ADD COLUMN IF NOT EXISTS search_keywords text;
