-- earrands schema

create table festivals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  location text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references festivals(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

create table sets (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references festivals(id) on delete cascade,
  stage_id uuid references stages(id) on delete cascade,
  artist_name text not null,
  day date not null,
  start_time time not null,
  end_time time not null,
  is_live boolean default false
);

create table user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  set_id uuid references sets(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, set_id)
);

create table user_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  set_id uuid references sets(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  created_at timestamptz default now(),
  unique(user_id, set_id)
);

-- RLS
alter table festivals enable row level security;
alter table stages enable row level security;
alter table sets enable row level security;
alter table user_plans enable row level security;
alter table user_ratings enable row level security;

-- Public read on timetable data
create policy "public_read" on festivals for select using (true);
create policy "public_read" on stages for select using (true);
create policy "public_read" on sets for select using (true);

-- user_plans: users own their rows
create policy "select_own" on user_plans for select using (auth.uid() = user_id);
create policy "insert_own" on user_plans for insert with check (auth.uid() = user_id);
create policy "delete_own" on user_plans for delete using (auth.uid() = user_id);

-- user_ratings: users own their rows (update allowed to change rating)
create policy "select_own" on user_ratings for select using (auth.uid() = user_id);
create policy "insert_own" on user_ratings for insert with check (auth.uid() = user_id);
create policy "update_own" on user_ratings for update using (auth.uid() = user_id);
create policy "delete_own" on user_ratings for delete using (auth.uid() = user_id);

-- Indexes
create index idx_sets_festival_day on sets(festival_id, day);
create index idx_sets_stage on sets(stage_id);
create index idx_user_plans_user on user_plans(user_id);
create index idx_user_plans_set on user_plans(set_id);
create index idx_user_ratings_user on user_ratings(user_id);
create index idx_user_ratings_set on user_ratings(set_id);
