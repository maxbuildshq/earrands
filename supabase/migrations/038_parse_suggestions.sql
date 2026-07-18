-- Phase 2b: parsing-arbiter suggestions — LLM-proposed corrections for raw
-- set names the novelty detector flagged as unclean parses. Suggestions only:
-- rows are written by parse-artists --arbiter (service role), reviewed in
-- admin (accept/dismiss = status flip via edge function), and applied to
-- set_artists by a later parse-artists run. Additive — nothing existing changes.

create table if not exists parse_suggestions (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  raw_name text not null,
  current_parse jsonb not null,   -- { collective, members, role } from the rule parser
  suggested jsonb not null,       -- { collective, members } from the arbiter
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  reason text not null default '',
  detector_reasons jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (festival_id, raw_name)
);

-- Service-role only: RLS on, no policies (admin access goes through edge functions)
alter table parse_suggestions enable row level security;

create index if not exists parse_suggestions_festival_status_idx
  on parse_suggestions (festival_id, status);
