-- Multi-festival support: allow lineup-only festivals (no times, no assigned stage)

ALTER TABLE sets ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE sets ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE sets ALTER COLUMN stage_id DROP NOT NULL;

-- Festival status flag
ALTER TABLE festivals ADD COLUMN timetable_announced boolean DEFAULT true;

-- Mark existing Awakenings festival
UPDATE festivals SET timetable_announced = true WHERE slug = 'awakenings-upclose-2026';

-- Seed: 909 Festival 2026
WITH fest AS (
  INSERT INTO festivals (name, slug, location, start_date, end_date, timetable_announced)
  VALUES ('909 Festival 2026', '909-2026', 'Amsterdamse Bos, Amsterdam', '2026-06-06', '2026-06-07', false)
  RETURNING id
)
INSERT INTO sets (festival_id, stage_id, artist_name, day, start_time, end_time, is_live)
SELECT id, NULL, 'Adam Beyer',              '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Anfisa Letyago',         '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Bart Skils x Marco Faraone', '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Beste Hira',             '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'D Stone',                '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'David Löhlein',          '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Dimitri',                '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'DJORA',                  '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Fjaak x KiNK',          '2026-06-06'::date, NULL, NULL, true  FROM fest
UNION ALL SELECT id, NULL, 'Folamour',               '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Héctor Oaks',            '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Kirollus x Tonno Disko', '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Lobster',                '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Mall Grab',              '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Marcel Dettmann',        '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Merel Helderman',        '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Myra',                   '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Octave One',             '2026-06-06'::date, NULL, NULL, true  FROM fest
UNION ALL SELECT id, NULL, 'ONYVAA',                 '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Parallelle',             '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Ron Trent',              '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'S.A.M.',                 '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'salute',                 '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Speedy J',               '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Suze Ijó',               '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Tjade',                  '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Tommy Chikara',          '2026-06-06'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Vince Watson',           '2026-06-06'::date, NULL, NULL, false FROM fest
-- Sunday June 7
UNION ALL SELECT id, NULL, 'Across Boundaries',      '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Amoral',                 '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Ben Böhmer',             '2026-06-07'::date, NULL, NULL, true  FROM fest
UNION ALL SELECT id, NULL, 'Benny Rodrigues x CARISTA', '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Berkan V8',              '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Boss Priester',          '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Daria Kolosova',         '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'DAX J',                  '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Eric Prydz',             '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Human Safari',           '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Jeff Mills',             '2026-06-07'::date, NULL, NULL, true  FROM fest
UNION ALL SELECT id, NULL, 'Jesabel',                '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Kaufmann',               '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Kevin Saunderson',       '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Len Faki',               '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Maceo Plex',             '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Mano Le Tough',          '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Mary Lake',              '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Mees Salomé',            '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Mind Against',           '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Pan-Pot',                '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'PARAMIDA',               '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Paul Kalkbrenner',       '2026-06-07'::date, NULL, NULL, true  FROM fest
UNION ALL SELECT id, NULL, 'Satoshi Tomiie',         '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Simone de Kunovich',     '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Sole Dosi',              '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Stef Mendesidis',        '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Stranger',               '2026-06-07'::date, NULL, NULL, false FROM fest
UNION ALL SELECT id, NULL, 'Yanamaste',              '2026-06-07'::date, NULL, NULL, false FROM fest;
