-- Real push notification delivery (Expo push service): a user's device
-- token(s) and a log of what's actually been sent, so a daily job never
-- double-sends the same reminder if it's triggered more than once in a day.
--
-- Writes go entirely through the backend (service-role key, bypasses RLS)
-- -- registering a token and sending to Expo's push API are real
-- server-side orchestration, the same "goes through the backend" call
-- CLAUDE.md's hybrid architecture rule makes for every other third-party
-- integration in this app. No insert/update/delete policy is defined here,
-- so a direct write from the client is never possible even by mistake --
-- only a select-own policy, for a possible future "manage my devices" UI.

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Re-registering the same device (e.g. on every app launch) upserts
  -- rather than duplicating.
  unique (user_id, expo_push_token)
);

create index device_push_tokens_user_idx on public.device_push_tokens (user_id);

create trigger set_updated_at
before update on public.device_push_tokens
for each row execute function public.set_updated_at();

alter table public.device_push_tokens enable row level security;

create policy "device_push_tokens_select_own"
on public.device_push_tokens for select
to authenticated
using (user_id = auth.uid());

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null check (notification_type in ('next_workout', 'food_log_reminder')),
  sent_at timestamptz not null default now()
);

create index notification_log_user_type_sent_idx
on public.notification_log (user_id, notification_type, sent_at desc);

alter table public.notification_log enable row level security;

create policy "notification_log_select_own"
on public.notification_log for select
to authenticated
using (user_id = auth.uid());
