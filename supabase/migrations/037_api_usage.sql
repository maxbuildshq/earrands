-- Phase 1g (ADR 011): per-vendor API usage counters, daily granularity.
-- Written by enrichment scripts (service role) via increment_api_usage;
-- read by the admin dashboard API-budgets panel. Additive — nothing existing changes.

create table if not exists api_usage (
  vendor text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (vendor, day)
);

-- Service-role only: RLS on, no policies
alter table api_usage enable row level security;

create or replace function increment_api_usage(v text, n integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into api_usage (vendor, day, count) values (v, current_date, n)
  on conflict (vendor, day) do update set count = api_usage.count + n;
$$;

revoke execute on function increment_api_usage(text, integer) from public, anon, authenticated;
