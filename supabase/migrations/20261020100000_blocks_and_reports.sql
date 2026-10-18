-- ---------------------------------------------------------------------------
-- Blocking and reporting
-- ---------------------------------------------------------------------------
-- Blocking someone ends what connects the two of you and stops them reaching
-- you again: you stop following each other, their pending follow request,
-- group invite and trainer link request are removed, and from then on neither
-- of you can follow the other, invite the other to a group or request a
-- trainer link with them, and neither appears in the other's search or
-- suggestions. An active trainer link is left alone: ending it has its own
-- flow and consequences (Trainer Access).
--
-- Social reads and writes all go through the API with the service-role
-- client, which checks blocks (see apps/api/src/safety). The follow trigger
-- below holds the core rule in the database too.
--
-- A report records a person (and optionally one of their workouts) with a
-- reason, for review in the Supabase dashboard. Nothing is hidden
-- automatically on a report.

create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- Your own block list is yours to read. Writes go through block_user /
-- the API only.
create policy "user_blocks_select_own"
on public.user_blocks for select
to authenticated
using (blocker_id = auth.uid());

revoke insert, update, delete on public.user_blocks from anon, authenticated;

-- Either direction: a blocks b, or b blocks a.
create function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to service_role;

create function public.trg_follows_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_between(NEW.follower_id, NEW.followee_id) then
    raise exception 'cannot follow a blocked user' using errcode = '42501';
  end if;
  return NEW;
end;
$$;

revoke execute on function public.trg_follows_not_blocked() from public, anon, authenticated;

create trigger follows_not_blocked
before insert on public.follows
for each row execute function public.trg_follows_not_blocked();

-- Blocks p_blocked for p_blocker and removes what connects them, in one
-- transaction. Idempotent. Called by the API (service role) only.
create function public.block_user(p_blocker uuid, p_blocked uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_blocker = p_blocked then
    raise exception 'you cannot block yourself' using errcode = '22023';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (p_blocker, p_blocked)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Following each other, either way, accepted or still pending.
  delete from public.follows
  where (follower_id = p_blocker and followee_id = p_blocked)
     or (follower_id = p_blocked and followee_id = p_blocker);

  -- A group invite one of them sent the other and that wasn't answered yet.
  delete from public.workout_group_members
  where status = 'invited'
    and ((user_id = p_blocker and added_by = p_blocked)
      or (user_id = p_blocked and added_by = p_blocker));

  -- A trainer link request not yet accepted, either way.
  delete from public.trainer_clients
  where status = 'pending'
    and ((trainer_id = p_blocker and client_id = p_blocked)
      or (trainer_id = p_blocked and client_id = p_blocker));
end;
$$;

revoke all on function public.block_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.block_user(uuid, uuid) to service_role;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  -- A report outlives its reporter's account, since it may still need review.
  reporter_id uuid references auth.users (id) on delete set null,
  -- Nothing left to review once the reported account is gone.
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null,
  reason text not null
    check (reason in ('spam', 'harassment', 'inappropriate', 'impersonation', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id is null or reporter_id <> reported_user_id)
);

create index user_reports_open_idx on public.user_reports (created_at) where status = 'open';

alter table public.user_reports enable row level security;

-- No client policies at all: reports are written by the API and read in the
-- Supabase dashboard.
revoke all on public.user_reports from anon, authenticated;
