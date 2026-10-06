-- Email invites for trainer mode.
--
-- A trainer invites someone by email without the system revealing whether that
-- email already has an account. The invite is stored as typed, and it attaches
-- to whoever signs in with that (verified) email next. Nothing here tells the
-- trainer whether an account exists.

create table public.trainer_invites (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  -- Always stored lowercase; the API normalises before writing.
  email text not null check (email = lower(email)),
  display_name text,
  birthday date,
  height_value numeric,
  height_unit text not null default 'cm' check (height_unit in ('cm', 'ft_in')),
  weight_value numeric,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.trainer_invites
for each row execute function public.set_updated_at();

-- One pending invite per trainer and email. Re-inviting the same person
-- updates the pending row rather than adding a second one.
create unique index trainer_invites_pending_unique
on public.trainer_invites (trainer_id, email)
where status = 'pending';

create index trainer_invites_pending_email_idx
on public.trainer_invites (email)
where status = 'pending';

alter table public.trainer_invites enable row level security;

-- A trainer sees their own invites. Nobody else can read them, and writes go
-- through the API (service role), which owns the rules.
create policy "trainer_invites_select_trainer"
on public.trainer_invites for select
to authenticated
using (trainer_id = auth.uid());

revoke insert, update, delete on public.trainer_invites from anon, authenticated;

-- The email lookup is no longer used: the API never tells a trainer whether an
-- email has an account.
drop function public.find_auth_user_id_by_email(text);
