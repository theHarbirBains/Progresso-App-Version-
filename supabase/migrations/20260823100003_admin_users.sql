-- Elevated-permission grants. Absence from this table means "regular user" --
-- there is no role column on public.users to keep "is admin" out of the
-- everyday user row and avoid a second place that can drift out of sync.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('support_admin', 'full_admin')),
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Deliberately no policies for authenticated/anon: this table is never
-- readable or writable by the client. Only service_role (which bypasses RLS)
-- may grant/revoke admin access or check who holds it. This closes the
-- "grant myself admin" escalation path entirely, and keeps the set of
-- admins invisible to regular users.
