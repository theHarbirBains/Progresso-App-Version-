-- Server-side projection/cache of RevenueCat entitlement state. RevenueCat
-- itself remains authoritative; this table is only ever written by the
-- backend (service-role) once the webhook handler exists (Phase 8). No
-- status/event-log infrastructure is added yet since nothing writes to it
-- until that handler is built.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  revenuecat_customer_id text not null,
  status text not null default 'unknown',
  product_id text,
  entitlement_id text,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  will_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create unique index subscriptions_revenuecat_customer_id_idx
on public.subscriptions (revenuecat_customer_id);

alter table public.subscriptions enable row level security;

-- Read-only for the owning user: they can see their own subscription state
-- so the app can show it, but only service-role may write it. A regular
-- user granting themselves a subscription is not a client-reachable action.
create policy "subscriptions_select_own"
on public.subscriptions for select
to authenticated
using (user_id = auth.uid());
