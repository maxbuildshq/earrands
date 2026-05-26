-- Fix festival name/slug, stage sort order, and drop unused column

-- Drop unused awakenings_url column from sets
ALTER TABLE sets DROP COLUMN IF EXISTS awakenings_url;

-- Rename festival and update slug
UPDATE festivals
SET name = 'Awakenings Festival 2026',
    slug = 'awakenings-festival-2026'
WHERE slug = '2026-awakenings-festival';

-- Fix stage sort order: Area Y before AREA N (CAMPING AFTER)
UPDATE stages SET sort_order = 7
WHERE festival_id = (SELECT id FROM festivals WHERE slug = 'awakenings-festival-2026')
  AND name = 'Area Y';

UPDATE stages SET sort_order = 8
WHERE festival_id = (SELECT id FROM festivals WHERE slug = 'awakenings-festival-2026')
  AND name = 'AREA N (CAMPING AFTER)';
