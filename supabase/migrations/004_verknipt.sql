-- Seed: Verknipt Festival 2026

WITH fest AS (
  INSERT INTO festivals (name, slug, location, start_date, end_date, timetable_announced)
  VALUES ('Verknipt Festival 2026', 'verknipt-2026', 'Strijkviertel, Utrecht', '2026-06-06', '2026-06-07', true)
  RETURNING id
),
s_surge AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'Surge', 1 FROM fest
  RETURNING id
),
s_fusion AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'Fusion', 2 FROM fest
  RETURNING id
),
s_f2f AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'Face 2 Face', 3 FROM fest
  RETURNING id
),
s_focus AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'Focus', 4 FROM fest
  RETURNING id
)
-- SATURDAY JUNE 6
-- Surge
INSERT INTO sets (festival_id, stage_id, artist_name, day, start_time, end_time, is_live)
SELECT fest.id, s_surge.id, 'Divasi',              '2026-06-06'::date, '13:00'::time, '14:30'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Johannes Schuster',   '2026-06-06'::date, '14:30'::time, '15:45'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Kuko',                '2026-06-06'::date, '15:45'::time, '17:15'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Hardsok',             '2026-06-06'::date, '17:15'::time, '18:15'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, '6ejou',               '2026-06-06'::date, '18:15'::time, '19:15'::time, true  FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Restricted',          '2026-06-06'::date, '19:15'::time, '20:45'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Vieze Asbak',         '2026-06-06'::date, '20:45'::time, '21:45'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'SLVL B2B USH',        '2026-06-06'::date, '21:45'::time, '23:00'::time, false FROM fest, s_surge
-- Fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Katy Rough',         '2026-06-06'::date, '13:00'::time, '14:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Rowin',              '2026-06-06'::date, '14:30'::time, '16:00'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Aphøtic',            '2026-06-06'::date, '16:00'::time, '17:15'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Nicolas Julian',     '2026-06-06'::date, '17:15'::time, '18:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Bøery',              '2026-06-06'::date, '18:30'::time, '19:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Raxeller',           '2026-06-06'::date, '19:30'::time, '20:45'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Toxic Machinery',    '2026-06-06'::date, '20:45'::time, '21:45'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Kruelty',            '2026-06-06'::date, '21:45'::time, '23:00'::time, false FROM fest, s_fusion
-- Face 2 Face
UNION ALL SELECT fest.id, s_f2f.id, 'DJ IP F2F Dr. G',       '2026-06-06'::date, '14:00'::time, '15:30'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Justin Jay F2F Rozie',  '2026-06-06'::date, '15:30'::time, '17:00'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Fumi F2F Serafina',     '2026-06-06'::date, '17:00'::time, '18:30'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Davyboi F2F Franck',    '2026-06-06'::date, '18:30'::time, '20:00'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Pawlowski F2F Peterblue', '2026-06-06'::date, '20:00'::time, '21:30'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Cloudy F2F Kuko',       '2026-06-06'::date, '21:30'::time, '23:00'::time, false FROM fest, s_f2f
-- Focus
UNION ALL SELECT fest.id, s_focus.id, 'Xamuel',              '2026-06-06'::date, '14:00'::time, '15:30'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Cortes B2B Nøraj',   '2026-06-06'::date, '15:30'::time, '17:00'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Jayron',             '2026-06-06'::date, '17:00'::time, '18:30'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'BLNK B2B Lieks',    '2026-06-06'::date, '18:30'::time, '20:00'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Titi',               '2026-06-06'::date, '20:00'::time, '21:30'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Neek',               '2026-06-06'::date, '21:30'::time, '23:00'::time, false FROM fest, s_focus

-- SUNDAY JUNE 7
-- Surge
UNION ALL SELECT fest.id, s_surge.id, 'Area Øne',           '2026-06-07'::date, '12:00'::time, '13:30'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Byorn',              '2026-06-07'::date, '13:30'::time, '15:00'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Santøs',             '2026-06-07'::date, '15:00'::time, '17:00'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Winson',             '2026-06-07'::date, '17:00'::time, '19:00'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Klofama',            '2026-06-07'::date, '19:00'::time, '21:00'::time, false FROM fest, s_surge
UNION ALL SELECT fest.id, s_surge.id, 'Fantasm',            '2026-06-07'::date, '21:00'::time, '23:00'::time, false FROM fest, s_surge
-- Fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Føss',              '2026-06-07'::date, '12:00'::time, '14:00'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Nikolina',          '2026-06-07'::date, '14:00'::time, '15:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Tassery',           '2026-06-07'::date, '15:30'::time, '16:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Ben Techy',         '2026-06-07'::date, '16:30'::time, '17:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Rebekah',           '2026-06-07'::date, '17:30'::time, '18:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Jo3y3t',            '2026-06-07'::date, '18:30'::time, '19:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'LS41',              '2026-06-07'::date, '19:30'::time, '20:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Karah',             '2026-06-07'::date, '20:30'::time, '21:30'::time, false FROM fest, s_fusion
UNION ALL SELECT fest.id, s_fusion.id, 'Jazzy B2B Jowi',    '2026-06-07'::date, '21:30'::time, '23:00'::time, false FROM fest, s_fusion
-- Face 2 Face
UNION ALL SELECT fest.id, s_f2f.id, 'Aprd F2F Zuke',        '2026-06-07'::date, '13:00'::time, '15:00'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Entasia F2F Freddi',   '2026-06-07'::date, '15:00'::time, '16:30'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Inafekt F2F Newtone',  '2026-06-07'::date, '16:30'::time, '18:00'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Hurts F2F Nyco',       '2026-06-07'::date, '18:00'::time, '19:30'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Cleopard2000 F2F Iosio', '2026-06-07'::date, '19:30'::time, '21:15'::time, false FROM fest, s_f2f
UNION ALL SELECT fest.id, s_f2f.id, 'Wilderich F2F Zwilling.', '2026-06-07'::date, '21:15'::time, '23:00'::time, false FROM fest, s_f2f
-- Focus
UNION ALL SELECT fest.id, s_focus.id, 'Sup',                '2026-06-07'::date, '13:00'::time, '14:30'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Loren',              '2026-06-07'::date, '14:30'::time, '16:00'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Nzgûl',              '2026-06-07'::date, '16:00'::time, '17:00'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Blurred Movement B2B Ramøn', '2026-06-07'::date, '17:00'::time, '18:30'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Fumi B2B Jånks',     '2026-06-07'::date, '18:30'::time, '20:00'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Jalo B2B Vino',      '2026-06-07'::date, '20:00'::time, '21:30'::time, false FROM fest, s_focus
UNION ALL SELECT fest.id, s_focus.id, 'Dros B2B Juul Exler', '2026-06-07'::date, '21:30'::time, '23:00'::time, false FROM fest, s_focus;
