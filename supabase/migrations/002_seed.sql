-- Seed: Awakenings Upclose 2026

WITH fest AS (
  INSERT INTO festivals (name, slug, location, start_date, end_date)
  VALUES ('Awakenings Upclose 2026', 'awakenings-upclose-2026', 'Spaarnwoude-park, Netherlands', '2026-05-16', '2026-05-17')
  RETURNING id
),
s_97 AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'area.97', 1 FROM fest
  RETURNING id
),
s_01 AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'area.01', 2 FROM fest
  RETURNING id
),
s_07 AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'area.07', 3 FROM fest
  RETURNING id
),
s_14 AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'area.14', 4 FROM fest
  RETURNING id
),
s_22 AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'area.22', 5 FROM fest
  RETURNING id
),
s_24 AS (
  INSERT INTO stages (festival_id, name, sort_order)
  SELECT id, 'area.24', 6 FROM fest
  RETURNING id
)
INSERT INTO sets (festival_id, stage_id, artist_name, day, start_time, end_time, is_live)
SELECT fest.id, s_97.id, 'Luna Ludmila',                                    '2026-05-16'::date, '12:00'::time, '14:00'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Shed vs Head High',                     '2026-05-16'::date, '14:00'::time, '15:45'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'ROD & Sterac',                          '2026-05-16'::date, '15:45'::time, '17:30'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Joris Voorn',                           '2026-05-16'::date, '17:30'::time, '19:00'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Alarico & Ben Klock',                   '2026-05-16'::date, '19:00'::time, '21:00'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Collabs 3000 (Chris Liebing & Speedy J)','2026-05-16'::date, '21:00'::time, '23:00'::time, false FROM fest, s_97

UNION ALL SELECT fest.id, s_01.id, 'Varuna Agosti',                         '2026-05-16'::date, '12:00'::time, '14:30'::time, false FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'DJ Red',                                '2026-05-16'::date, '14:30'::time, '16:30'::time, false FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Andy Martin',                           '2026-05-16'::date, '16:30'::time, '18:15'::time, false FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Len Faki & Quest',                      '2026-05-16'::date, '18:15'::time, '20:15'::time, false FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Planetary Assault Systems',             '2026-05-16'::date, '20:15'::time, '21:30'::time, true  FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Rene Wise',                             '2026-05-16'::date, '21:30'::time, '23:00'::time, false FROM fest, s_01

UNION ALL SELECT fest.id, s_07.id, 'Fiene',                                 '2026-05-16'::date, '12:00'::time, '14:00'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'EMILIJA & Fenrick',                     '2026-05-16'::date, '14:00'::time, '16:00'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'Noise Mafia & Peterblue',               '2026-05-16'::date, '16:00'::time, '17:45'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'Fumi & SPFDJ',                          '2026-05-16'::date, '17:45'::time, '19:30'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'Kobosil & Ornella',                     '2026-05-16'::date, '19:30'::time, '21:30'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'DIØN',                                  '2026-05-16'::date, '21:30'::time, '23:00'::time, false FROM fest, s_07

UNION ALL SELECT fest.id, s_14.id, 'Essy',                                  '2026-05-16'::date, '12:00'::time, '14:00'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Dr. G',                                 '2026-05-16'::date, '14:00'::time, '15:45'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'BIIANCO',                               '2026-05-16'::date, '15:45'::time, '17:15'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'DJ Boring',                             '2026-05-16'::date, '17:15'::time, '19:00'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Cybersex',                              '2026-05-16'::date, '19:00'::time, '21:00'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Ellen Allien',                          '2026-05-16'::date, '21:00'::time, '23:00'::time, false FROM fest, s_14

UNION ALL SELECT fest.id, s_22.id, 'Morgan',                                '2026-05-16'::date, '12:00'::time, '14:00'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Naone',                                 '2026-05-16'::date, '14:00'::time, '16:00'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Alarico',                               '2026-05-16'::date, '16:00'::time, '18:00'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Sweely',                                '2026-05-16'::date, '18:00'::time, '19:00'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Ryan Elliott',                          '2026-05-16'::date, '19:00'::time, '21:00'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Blasha & Allatt',                       '2026-05-16'::date, '21:00'::time, '23:00'::time, false FROM fest, s_22

UNION ALL SELECT fest.id, s_24.id, 'Prance',                                '2026-05-16'::date, '12:00'::time, '14:00'::time, false FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Undivulged (Beau Didier, Flits, Isaiah & Lasse)', '2026-05-16'::date, '14:00'::time, '16:00'::time, false FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Dold',                                  '2026-05-16'::date, '16:00'::time, '17:00'::time, true  FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Ogazón',                                '2026-05-16'::date, '17:00'::time, '19:00'::time, false FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Chontane',                              '2026-05-16'::date, '19:00'::time, '20:00'::time, true  FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Hayes Collective (Cravo, Nørbak, Temudo & Vil)', '2026-05-16'::date, '20:00'::time, '23:00'::time, false FROM fest, s_24

-- SUNDAY
UNION ALL SELECT fest.id, s_97.id, 'TWIENA',                                '2026-05-17'::date, '13:00'::time, '14:30'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Beste Hira & Lobster',                  '2026-05-17'::date, '14:30'::time, '16:00'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'ANNĒ & Ben Sims',                       '2026-05-17'::date, '16:00'::time, '17:45'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Anetha & Pegassi',                      '2026-05-17'::date, '17:45'::time, '19:30'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Ben UFO & Four Tet',                    '2026-05-17'::date, '19:30'::time, '21:30'::time, false FROM fest, s_97
UNION ALL SELECT fest.id, s_97.id, 'Nina Kraviz',                           '2026-05-17'::date, '21:30'::time, '23:00'::time, false FROM fest, s_97

UNION ALL SELECT fest.id, s_01.id, 'Remma & Thoms Traxx',                   '2026-05-17'::date, '13:00'::time, '14:45'::time, false FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Cio D''Or & Claudio PRC',               '2026-05-17'::date, '14:45'::time, '16:15'::time, false FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Abstract Division & JakoJako',          '2026-05-17'::date, '16:15'::time, '18:00'::time, false FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'LSD: Luke Slater, Steve Bicknell and Function', '2026-05-17'::date, '18:00'::time, '19:30'::time, true  FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Ignez & Rødhåd',                        '2026-05-17'::date, '19:30'::time, '21:00'::time, true  FROM fest, s_01
UNION ALL SELECT fest.id, s_01.id, 'Freddy K & Marrøn',                     '2026-05-17'::date, '21:00'::time, '23:00'::time, false FROM fest, s_01

UNION ALL SELECT fest.id, s_07.id, 'Alycia Bezgo',                          '2026-05-17'::date, '13:00'::time, '15:00'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'Faster Horses & Stef de Haan',          '2026-05-17'::date, '15:00'::time, '16:45'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'The Tunegirl',                          '2026-05-17'::date, '16:45'::time, '17:45'::time, true  FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'Adrián Mills',                          '2026-05-17'::date, '17:45'::time, '19:30'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'Ciara Cuvé',                            '2026-05-17'::date, '19:30'::time, '21:15'::time, false FROM fest, s_07
UNION ALL SELECT fest.id, s_07.id, 'Azyr & Charlie Sparks',                 '2026-05-17'::date, '21:15'::time, '23:00'::time, false FROM fest, s_07

UNION ALL SELECT fest.id, s_14.id, 'Kyra Khaldi',                           '2026-05-17'::date, '13:00'::time, '14:30'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Aldonna',                               '2026-05-17'::date, '14:30'::time, '15:45'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Main phase',                            '2026-05-17'::date, '15:45'::time, '17:00'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Milion',                                '2026-05-17'::date, '17:00'::time, '18:30'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Emvae & Moxes',                         '2026-05-17'::date, '18:30'::time, '20:00'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Helena Lauwaert',                       '2026-05-17'::date, '20:00'::time, '21:30'::time, false FROM fest, s_14
UNION ALL SELECT fest.id, s_14.id, 'Sam Alfred',                            '2026-05-17'::date, '21:30'::time, '23:00'::time, false FROM fest, s_14

UNION ALL SELECT fest.id, s_22.id, 'Hannecart',                             '2026-05-17'::date, '13:00'::time, '14:45'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Rene Wise',                             '2026-05-17'::date, '14:45'::time, '16:30'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Paranoid London',                       '2026-05-17'::date, '16:30'::time, '17:30'::time, true  FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Freddy K',                              '2026-05-17'::date, '17:30'::time, '19:15'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'Doudou MD & Jennifer Loveless',         '2026-05-17'::date, '19:15'::time, '21:15'::time, false FROM fest, s_22
UNION ALL SELECT fest.id, s_22.id, 'DJ Sweet6teen',                         '2026-05-17'::date, '21:15'::time, '23:00'::time, false FROM fest, s_22

UNION ALL SELECT fest.id, s_24.id, 'Karina Schneider',                      '2026-05-17'::date, '13:00'::time, '14:30'::time, false FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'JSPRV35 & Toobris',                     '2026-05-17'::date, '14:30'::time, '16:15'::time, false FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'UFO95',                                 '2026-05-17'::date, '16:15'::time, '17:15'::time, true  FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Kameliia & Setaoc Mass',                '2026-05-17'::date, '17:15'::time, '19:00'::time, false FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Colin Benders & Dasha Rush',            '2026-05-17'::date, '19:00'::time, '20:30'::time, true  FROM fest, s_24
UNION ALL SELECT fest.id, s_24.id, 'Jeans & Spekki Webu & Woody92',         '2026-05-17'::date, '20:30'::time, '23:00'::time, false FROM fest, s_24;
