create table shared_schedules (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  festival_id uuid references festivals(id) on delete cascade not null,
  set_ids uuid[] not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, festival_id)
);

create index idx_shared_schedules_code on shared_schedules(code);

alter table shared_schedules enable row level security;

create policy "public_read" on shared_schedules for select using (true);
create policy "insert_own" on shared_schedules for insert with check (auth.uid() = user_id);
create policy "update_own" on shared_schedules for update using (auth.uid() = user_id);
