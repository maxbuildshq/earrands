-- Backfill bio_festival from existing bios that came from festival websites.
-- artists.source_url contains the festival page URL used during ingest.
-- If an artist has bio + source_url, the bio is from that festival → copy to bio_festival.

-- Copy bio to bio_festival for artists that have a source_url (festival-originated bio)
UPDATE artists
SET bio_festival = bio
WHERE bio IS NOT NULL
  AND source_url IS NOT NULL
  AND bio_festival IS NULL;

-- Set bio_source based on source_url domain
-- Extract festival slug from known domains
UPDATE artists
SET bio_source = CASE
  WHEN source_url LIKE '%awakenings.com%' THEN 'festival:awakenings'
  WHEN source_url LIKE '%dekmantel%' THEN 'festival:dekmantel'
  ELSE 'festival'
END
WHERE bio IS NOT NULL
  AND source_url IS NOT NULL
  AND bio_source IS NULL;
