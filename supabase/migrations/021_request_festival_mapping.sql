-- Allow mapping festival requests to actual festivals for fuzzy name matching
ALTER TABLE festival_requests ADD COLUMN IF NOT EXISTS matched_festival_id uuid REFERENCES festivals(id);
