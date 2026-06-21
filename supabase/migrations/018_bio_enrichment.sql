-- Bio enrichment: location, bio provenance, and enrichment status
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio_source text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio_festival text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio_sources jsonb;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';
