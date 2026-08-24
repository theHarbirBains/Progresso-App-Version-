-- Audit log + idempotency store for RevenueCat webhook deliveries. The
-- primary key is RevenueCat's own event id: retried deliveries reuse the
-- same id (RevenueCat's documented behavior), so a duplicate INSERT here
-- *is* the idempotency check — no separate lookup needed.
create table public.subscription_events (
  id text primary key,
  event_type text not null,
  -- Raw value from the event, not FK-constrained: RevenueCat can send
  -- test events or events for an app_user_id that doesn't resolve to a
  -- real user. The event is still audited even when it can't be applied.
  app_user_id text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'skipped', 'failed')),
  processing_note text,
  received_at timestamptz not null default now()
);

create index subscription_events_app_user_id_idx on public.subscription_events (app_user_id);

alter table public.subscription_events enable row level security;

-- Deliberately no policies for authenticated/anon: this is an internal
-- audit log, written only by the backend's webhook handler via
-- service-role, never readable or writable by any client directly.

-- Timestamp of the last event actually applied to this subscription's
-- projection, so an out-of-order delivery (an older event arriving after
-- a newer one was already applied) can be detected and skipped instead of
-- overwriting more current state with stale data.
alter table public.subscriptions add column last_event_at timestamptz;
