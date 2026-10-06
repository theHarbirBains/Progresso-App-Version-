-- Live sessions and group workouts.
--
-- 1. Several workouts can be open at once, one per session. A session is the
--    group the workout belongs to, else the trainer running it, else the owner.
--    So a person can record their own workout while a group session they are in
--    is open, and a trainer can run a live session for a client at the same time.
-- 2. A group has a host and members (users with accounts, and guests who have
--    none). Any joined member with an account can read and edit every group
--    workout's exercises and sets. Each member's workout is still owned by that
--    member's user_id, so PR and data-isolation rules are unchanged.
-- 3. Guests are placeholder accounts, the same as tracked clients.

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table public.workout_groups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  status text not null default 'live' check (status in ('live', 'finished')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'live' or finished_at is not null)
);

create trigger set_updated_at
before update on public.workout_groups
for each row execute function public.set_updated_at();

create table public.workout_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.workout_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('host', 'member')),
  -- invited: waiting to accept. joined: can read and edit the group. left: out.
  status text not null check (status in ('invited', 'joined', 'left')),
  is_guest boolean not null default false,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create trigger set_updated_at
before update on public.workout_group_members
for each row execute function public.set_updated_at();

create index workout_group_members_user_idx on public.workout_group_members (user_id);

-- A group's workouts: the group a workout belongs to. Restrict, so a group with
-- workouts cannot be deleted by accident.
alter table public.workouts
  add column group_id uuid references public.workout_groups (id) on delete restrict;

create index workouts_group_id_idx on public.workouts (group_id) where group_id is not null;

-- ---------------------------------------------------------------------------
-- One open workout per owner and session
-- ---------------------------------------------------------------------------

drop index if exists public.workouts_one_active_per_user;

create unique index workouts_one_active_per_session
on public.workouts (user_id, coalesce(group_id::text, logged_by::text, user_id::text))
where completed_at is null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer: they read membership without recursing
-- through the policies that call them)
-- ---------------------------------------------------------------------------

create function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_group_members m
    where m.group_id = p_group
      and m.user_id = auth.uid()
      and m.status = 'joined'
  );
$$;

create function public.can_edit_group_workout(p_workout uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workouts w
    where w.id = p_workout
      and w.group_id is not null
      and public.is_group_member(w.group_id)
  );
$$;

create function public.can_edit_group_workout_exercise(p_workout_exercise uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_exercises we
    where we.id = p_workout_exercise
      and public.can_edit_group_workout(we.workout_id)
  );
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.can_edit_group_workout(uuid) from public, anon;
revoke all on function public.can_edit_group_workout_exercise(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Group tables: read by the people in them, written only by the API
-- ---------------------------------------------------------------------------

alter table public.workout_groups enable row level security;
alter table public.workout_group_members enable row level security;

create policy "workout_groups_select_members"
on public.workout_groups for select
to authenticated
using (
  host_id = auth.uid()
  or exists (
    select 1 from public.workout_group_members m
    where m.group_id = workout_groups.id and m.user_id = auth.uid()
  )
);

create policy "workout_group_members_select_party"
on public.workout_group_members for select
to authenticated
using (user_id = auth.uid() or public.is_group_member(group_id));

revoke insert, update, delete on public.workout_groups from anon, authenticated;
revoke insert, update, delete on public.workout_group_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Group workouts, exercises and sets: joined members can read and edit them
-- ---------------------------------------------------------------------------

create policy "workouts_group_select"
on public.workouts for select
to authenticated
using (group_id is not null and public.is_group_member(group_id));

create policy "workouts_group_update"
on public.workouts for update
to authenticated
using (group_id is not null and public.is_group_member(group_id))
with check (group_id is not null and public.is_group_member(group_id));

create policy "workout_exercises_group_select"
on public.workout_exercises for select
to authenticated
using (public.can_edit_group_workout(workout_id));

create policy "workout_exercises_group_insert"
on public.workout_exercises for insert
to authenticated
with check (public.can_edit_group_workout(workout_id));

create policy "workout_exercises_group_update"
on public.workout_exercises for update
to authenticated
using (public.can_edit_group_workout(workout_id))
with check (public.can_edit_group_workout(workout_id));

create policy "sets_group_select"
on public.sets for select
to authenticated
using (public.can_edit_group_workout_exercise(workout_exercise_id));

create policy "sets_group_insert"
on public.sets for insert
to authenticated
with check (public.can_edit_group_workout_exercise(workout_exercise_id));

create policy "sets_group_update"
on public.sets for update
to authenticated
using (public.can_edit_group_workout_exercise(workout_exercise_id))
with check (public.can_edit_group_workout_exercise(workout_exercise_id));

-- An exercise used in a group workout is readable by the group's members, so
-- every member sees its name and photo (exercises stay owned by whoever made them).
create policy "exercises_group_select"
on public.exercises for select
to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.exercise_id = exercises.id
      and w.group_id is not null
      and public.is_group_member(w.group_id)
  )
);

-- ---------------------------------------------------------------------------
-- Trainer live sessions: a trainer adding an exercise to a client's live
-- session needs the client's copy of it (copy-on-log, as for logged workouts).
-- ---------------------------------------------------------------------------

create function public.resolve_client_exercise(p_trainer uuid, p_client uuid, p_exercise uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ex public.exercises%rowtype;
  v_id uuid;
begin
  if not exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_id = p_trainer and tc.client_id = p_client and tc.status = 'active'
  ) then
    raise exception 'not an active client of this trainer' using errcode = '42501';
  end if;

  if not public.has_trainer_entitlement(p_trainer) then
    raise exception 'trainer entitlement is not active' using errcode = '42501';
  end if;

  select * into v_ex from public.exercises where id = p_exercise;
  if not found or not v_ex.is_active then
    raise exception 'exercise % is not available', p_exercise using errcode = 'P0002';
  end if;

  if v_ex.created_by is null or v_ex.created_by = p_client then
    return v_ex.id;
  end if;

  if v_ex.created_by <> p_trainer then
    raise exception 'exercise % is not in this trainer''s library', p_exercise using errcode = '42501';
  end if;

  select e.id into v_id
  from public.exercises e
  where e.created_by = p_client and lower(e.name) = lower(v_ex.name);
  if found then
    return v_id;
  end if;

  insert into public.exercises (created_by, name, muscle_group, movement_type, logging_style, photo_url)
  values (p_client, v_ex.name, v_ex.muscle_group, v_ex.movement_type, v_ex.logging_style, v_ex.photo_url)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.resolve_client_exercise(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_client_exercise(uuid, uuid, uuid) to service_role;
