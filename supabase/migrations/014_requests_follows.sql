-- Festival requests + follows (Phase 1: demand capture + timetable-drop notifications)

-- festival_follows: "notify me when this festival's timetable drops" (lineup-only festivals).
-- Channel-agnostic intent — no email column; the recipient address is derived from auth.users
-- at send time (see scripts/notify.ts), so a future push channel needs no migration here.
create table festival_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  festival_id uuid references festivals(id) on delete cascade,
  notified_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, festival_id)
);

-- festival_requests: free-text demand signal for festivals not yet in the app.
create table festival_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  raw_name text not null,
  region text,
  created_at timestamptz default now()
);

-- RLS
alter table festival_follows enable row level security;
alter table festival_requests enable row level security;

-- festival_follows: users own their rows. No update policy on purpose — notified_at is set
-- by the service role in scripts/notify.ts, which bypasses RLS.
create policy "select_own" on festival_follows for select using (auth.uid() = user_id);
create policy "insert_own" on festival_follows for insert with check (auth.uid() = user_id);
create policy "delete_own" on festival_follows for delete using (auth.uid() = user_id);

-- festival_requests: users insert and read their own rows. The owner reviews all requests
-- via the service role (bypasses RLS).
create policy "select_own" on festival_requests for select using (auth.uid() = user_id);
create policy "insert_own" on festival_requests for insert with check (auth.uid() = user_id);

-- Indexes
create index idx_festival_follows_user on festival_follows(user_id);
create index idx_festival_follows_festival on festival_follows(festival_id);
create index idx_festival_requests_user on festival_requests(user_id);
