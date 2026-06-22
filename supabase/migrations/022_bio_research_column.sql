-- Add bio_research JSONB column to store structured research data for AI bio generation.
-- bio_sources (jsonb array, added in 018) stores the flat provenance list for display.
-- bio_research stores the full structured input: SC/Discogs/festival text + web search results with page content.
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio_research jsonb;
