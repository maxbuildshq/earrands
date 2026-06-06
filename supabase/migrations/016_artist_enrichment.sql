-- Artist enrichment: add social links, image, and embed columns.
-- Festival publishing: add visibility toggle for staging workflow.

-- 1. Artist enrichment columns
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS soundcloud_url text,
  ADD COLUMN IF NOT EXISTS soundcloud_embed_url text,
  ADD COLUMN IF NOT EXISTS bandcamp_url text,
  ADD COLUMN IF NOT EXISTS discogs_id integer,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

-- 2. Festival publishing toggle
-- Default false: new festivals start unpublished (staging).
-- Set published=true after QA to make visible to users.
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS published boolean DEFAULT false;
