-- Performance type for sets: a set is normal, "live", or "hybrid" (mutually exclusive).
-- "hybrid" = a mix of DJing and live composition (Dekmantel introduced this tag).
-- Modeled as a single categorical column rather than a second boolean so the three
-- modes stay mutually exclusive and the set is extensible for future tags.
--
-- is_live is kept as-is (still written by the ingest pipeline) and remains the backfill
-- source; performance_type is what the UI reads. Once the ingest pipeline emits
-- performance_type directly, is_live can be retired in a follow-up.

ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS performance_type text
  CHECK (performance_type IN ('live', 'hybrid'));

-- Backfill existing live sets across all festivals.
UPDATE sets SET performance_type = 'live' WHERE is_live = true AND performance_type IS NULL;

-- Dekmantel 2026 hybrid sets (recovered from source; the "Hybrid" name suffix was
-- stripped by the scraper without being recorded as a flag).
UPDATE sets s
SET performance_type = 'hybrid'
FROM festivals f
WHERE s.festival_id = f.id
  AND f.slug = 'dekmantel-2026'
  AND s.artist_name IN ('Fjaak', 'Nazar', 'Khadija Al Hanafi');
