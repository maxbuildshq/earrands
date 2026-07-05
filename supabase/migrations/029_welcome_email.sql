-- Welcome email on signup confirmation (docs/onboarding-strategy.md, Layer C).
-- A trigger on auth.users calls the welcome-email edge function via pg_net when
-- a user's email is confirmed. Dedup lives in welcome_emails (edge function
-- inserts before sending).
--
-- Before applying: set the secret to match the edge function's WELCOME_EMAIL_SECRET:
--   select vault.create_secret('<secret>', 'welcome_email_secret');

create extension if not exists pg_net;

create table welcome_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- Service-role only: RLS enabled with no policies.
alter table welcome_emails enable row level security;

create or replace function public.notify_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'welcome_email_secret';

  perform net.http_post(
    url := 'https://guyogkcglnnkixbkxyir.supabase.co/functions/v1/welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-welcome-secret', secret
    ),
    body := jsonb_build_object('user_id', new.id, 'email', new.email)
  );
  return new;
end;
$$;

-- Fires when a user confirms their email (null -> not null), and on insert for
-- already-confirmed users (e.g. admin-created or autoconfirmed accounts).
create trigger welcome_email_on_confirm
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.notify_welcome_email();

create trigger welcome_email_on_insert
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.notify_welcome_email();
