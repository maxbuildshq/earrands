-- Artist normalization: creates artists + set_artists tables,
-- parses existing sets.artist_name into individual artist records.

-- 1. Tables
create table artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_name text not null,
  is_collective boolean default false,
  created_at timestamptz default now()
);

create unique index idx_artists_sort_name on artists(sort_name);

create table set_artists (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  role text not null default 'solo',
  billing_order smallint not null default 1,
  unique(set_id, artist_id)
);

create index idx_set_artists_artist on set_artists(artist_id);
create index idx_set_artists_set on set_artists(set_id);

-- 2. RLS (public read, matching existing tables)
alter table artists enable row level security;
alter table set_artists enable row level security;

create policy "public_read" on artists for select using (true);
create policy "public_read" on set_artists for select using (true);

-- 3. Parsing function (one-time use, dropped after execution)
create or replace function _parse_and_link_artists() returns void as $$
declare
  rec record;
  raw text;
  collective_name text;
  members text[];
  member text;
  role_val text;
  inner_content text;
  match_result text[];
  artist_uuid uuid;
  i int;
begin
  for rec in select id, artist_name, is_live from sets loop
    raw := trim(rec.artist_name);
    collective_name := null;
    members := null;
    role_val := 'solo';

    -- Strip "(live)" suffix if present in the text
    match_result := regexp_match(raw, '^(.+?)\s*\(live\)$', 'i');
    if match_result is not null then
      raw := trim(match_result[1]);
    end if;

    -- Priority 1: Colon format — "LSD: Luke Slater, Steve Bicknell and Function"
    if raw ~ '^[^:]+:.+$' and position(':' in raw) <= length(raw) / 2 then
      collective_name := trim(split_part(raw, ':', 1));
      inner_content := trim(substring(raw from position(':' in raw) + 1));
      -- Normalize " and " to ", " then split on ", "
      inner_content := replace(inner_content, ' and ', ', ');
      members := string_to_array(inner_content, ', ');
      role_val := 'member';

    -- Priority 2: Parenthetical members — "Collabs 3000 (Chris Liebing & Speedy J)"
    elsif raw ~ '^.+\s*\(.+\)$' then
      match_result := regexp_match(raw, '^(.+?)\s*\((.+)\)$');
      if match_result is not null then
        inner_content := match_result[2];
        -- Only treat as collective if inner contains , or &
        if inner_content ~ '[,&]' then
          collective_name := trim(match_result[1]);
          inner_content := replace(inner_content, ' & ', ', ');
          members := string_to_array(inner_content, ', ');
          role_val := 'member';
        else
          -- Parenthetical is a qualifier, not members (e.g., style note)
          members := array[raw];
          role_val := 'solo';
        end if;
      end if;

    -- Priority 3: F2F separator (case-insensitive)
    elsif raw ~* ' F2F ' then
      members := regexp_split_to_array(raw, ' [Ff]2[Ff] ');
      role_val := 'f2f';

    -- Priority 4: B2B separator (case-insensitive)
    elsif raw ~* ' B2B ' then
      members := regexp_split_to_array(raw, ' [Bb]2[Bb] ');
      role_val := 'b2b';

    -- Priority 5: "vs" separator
    elsif raw ~ ' vs ' then
      members := string_to_array(raw, ' vs ');
      role_val := 'vs';

    -- Priority 6: " x " separator (case-sensitive, won't match "DAX J" or "Toxic Machinery")
    elsif raw ~ ' x ' then
      members := string_to_array(raw, ' x ');
      role_val := 'collab';

    -- Priority 7: " & " separator (catches most multi-artist sets)
    elsif raw ~ ' & ' then
      members := string_to_array(raw, ' & ');
      role_val := 'collab';

    -- Priority 8: Solo artist
    else
      members := array[raw];
      role_val := 'solo';
    end if;

    -- Insert collective artist if detected
    if collective_name is not null then
      insert into artists (name, sort_name, is_collective)
      values (collective_name, lower(trim(collective_name)), true)
      on conflict (sort_name) do nothing;

      select a.id into artist_uuid
      from artists a where a.sort_name = lower(trim(collective_name));

      insert into set_artists (set_id, artist_id, role, billing_order)
      values (rec.id, artist_uuid, 'collab', 0)
      on conflict (set_id, artist_id) do nothing;
    end if;

    -- Insert each individual artist
    if members is not null then
      for i in 1..array_length(members, 1) loop
        member := trim(members[i]);
        if member = '' then continue; end if;

        insert into artists (name, sort_name, is_collective)
        values (member, lower(member), false)
        on conflict (sort_name) do nothing;

        select a.id into artist_uuid
        from artists a where a.sort_name = lower(member);

        insert into set_artists (set_id, artist_id, role, billing_order)
        values (rec.id, artist_uuid, role_val, i)
        on conflict (set_id, artist_id) do nothing;
      end loop;
    end if;
  end loop;
end;
$$ language plpgsql;

-- 4. Execute and drop
select _parse_and_link_artists();
drop function _parse_and_link_artists();

-- 5. Verification queries (run manually after migration):
-- Every set should have at least one linked artist:
--   SELECT s.id, s.artist_name FROM sets s
--   LEFT JOIN set_artists sa ON sa.set_id = s.id
--   WHERE sa.id IS NULL;
--   -- Expected: 0 rows
--
-- Cross-festival artists:
--   SELECT a.name, count(distinct sa.set_id) as set_count
--   FROM artists a JOIN set_artists sa ON sa.artist_id = a.id
--   GROUP BY a.name HAVING count(distinct sa.set_id) > 1
--   ORDER BY set_count DESC;
--   -- Expected: Fumi (3+), Len Faki (2+), Kuko (2+), Speedy J (2+), etc.
