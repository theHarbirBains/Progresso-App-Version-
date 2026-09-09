-- Workout Splits: a split only defines named workout days, each associated
-- with a set of muscle groups (public.muscle_group, the same enum
-- exercises.muscle_group already uses) -- deliberately NOT exercises. The
-- user picks actual exercises when they perform the workout; this table
-- only powers "what should I train today" and future exercise-filtering by
-- muscle group.
create table public.workout_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.workout_splits
for each row execute function public.set_updated_at();

create index workout_splits_user_id_idx on public.workout_splits (user_id);

alter table public.workout_splits enable row level security;

create policy "workout_splits_select_own"
on public.workout_splits for select
to authenticated
using (user_id = auth.uid());

create policy "workout_splits_insert_own"
on public.workout_splits for insert
to authenticated
with check (user_id = auth.uid());

create policy "workout_splits_update_own"
on public.workout_splits for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "workout_splits_delete_own"
on public.workout_splits for delete
to authenticated
using (user_id = auth.uid());

-- A split's ordered days. order_index drives both display order and the
-- next-workout cycle (day 1 -> day 2 -> ... -> day 1). Deferrable unique
-- constraint so a single bulk reorder request (matching workout_exercises'
-- own reordering pattern) can swap indexes within one statement.
create table public.workout_split_days (
  id uuid primary key default gen_random_uuid(),
  workout_split_id uuid not null references public.workout_splits (id) on delete cascade,
  -- Denormalized from workout_splits.user_id, always overwritten by
  -- trg_set_workout_split_day_owner below -- never trust the client value.
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_split_id, order_index) deferrable initially deferred
);

create trigger set_updated_at
before update on public.workout_split_days
for each row execute function public.set_updated_at();

create index workout_split_days_split_id_idx on public.workout_split_days (workout_split_id);
create index workout_split_days_user_id_idx on public.workout_split_days (user_id);

create function public.trg_set_workout_split_day_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select s.user_id into new.user_id
  from public.workout_splits s
  where s.id = new.workout_split_id;

  if new.user_id is null then
    raise exception 'workout split % does not exist', new.workout_split_id;
  end if;

  return new;
end;
$$;

create trigger set_workout_split_day_owner
before insert or update on public.workout_split_days
for each row execute function public.trg_set_workout_split_day_owner();

alter table public.workout_split_days enable row level security;

create policy "workout_split_days_select_own"
on public.workout_split_days for select
to authenticated
using (user_id = auth.uid());

create policy "workout_split_days_insert_own"
on public.workout_split_days for insert
to authenticated
with check (user_id = auth.uid());

create policy "workout_split_days_update_own"
on public.workout_split_days for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "workout_split_days_delete_own"
on public.workout_split_days for delete
to authenticated
using (user_id = auth.uid());

-- Muscle groups assigned to one split day. A day can have any number of
-- muscle groups (Push day: chest, shoulders, triceps); reuses
-- public.muscle_group exactly rather than a second vocabulary.
create table public.workout_split_day_muscle_groups (
  id uuid primary key default gen_random_uuid(),
  workout_split_day_id uuid not null references public.workout_split_days (id) on delete cascade,
  -- Denormalized from workout_split_days.user_id, trigger-enforced.
  user_id uuid not null references auth.users (id) on delete cascade,
  muscle_group public.muscle_group not null,
  created_at timestamptz not null default now(),
  unique (workout_split_day_id, muscle_group)
);

create index workout_split_day_muscle_groups_day_id_idx
on public.workout_split_day_muscle_groups (workout_split_day_id);
create index workout_split_day_muscle_groups_user_id_idx
on public.workout_split_day_muscle_groups (user_id);

create function public.trg_set_split_day_muscle_group_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select d.user_id into new.user_id
  from public.workout_split_days d
  where d.id = new.workout_split_day_id;

  if new.user_id is null then
    raise exception 'workout split day % does not exist', new.workout_split_day_id;
  end if;

  return new;
end;
$$;

create trigger set_split_day_muscle_group_owner
before insert or update on public.workout_split_day_muscle_groups
for each row execute function public.trg_set_split_day_muscle_group_owner();

alter table public.workout_split_day_muscle_groups enable row level security;

create policy "workout_split_day_muscle_groups_select_own"
on public.workout_split_day_muscle_groups for select
to authenticated
using (user_id = auth.uid());

create policy "workout_split_day_muscle_groups_insert_own"
on public.workout_split_day_muscle_groups for insert
to authenticated
with check (user_id = auth.uid());

create policy "workout_split_day_muscle_groups_delete_own"
on public.workout_split_day_muscle_groups for delete
to authenticated
using (user_id = auth.uid());

-- Exactly one active split per user, set null automatically if that split
-- is ever deleted (rather than blocking the delete or leaving a dangling
-- reference).
alter table public.users
  add column active_workout_split_id uuid references public.workout_splits (id) on delete set null;

-- Defense in depth: the foreign key above only checks the split exists, not
-- who owns it, so without this a user could point their own
-- active_workout_split_id at someone else's split id. RLS on workout_splits
-- already prevents actually reading that split's data, but this closes the
-- dangling-reference gap the same way trg_check_workout_split_day_owner
-- does for workouts.workout_split_day_id.
create function public.trg_check_active_workout_split_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  split_owner uuid;
begin
  if new.active_workout_split_id is null then
    return new;
  end if;

  select user_id into split_owner
  from public.workout_splits
  where id = new.active_workout_split_id;

  if split_owner is null or split_owner <> new.id then
    new.active_workout_split_id := null;
  end if;

  return new;
end;
$$;

create trigger check_active_workout_split_owner
before insert or update on public.users
for each row execute function public.trg_check_active_workout_split_owner();

-- Which split day a completed (or in-progress) workout was performed as --
-- deterministic tagging for next-workout logic, set at workout-start time
-- when a split is active. Nullable: historical workouts and workouts
-- performed with no active split simply have no tag. Cleared automatically
-- if that split day is ever deleted.
alter table public.workouts
  add column workout_split_day_id uuid references public.workout_split_days (id) on delete set null;

-- Defense in depth, mirroring workout_exercises' own owner-spoofing guard:
-- forces workout_split_day_id to actually belong to a split day owned by
-- this same workout's owner, regardless of what the client sends. A client
-- cannot tag their workout with another user's split day even by guessing
-- its id, since the mismatch here is corrected to null rather than trusted.
create function public.trg_check_workout_split_day_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  day_owner uuid;
begin
  if new.workout_split_day_id is null then
    return new;
  end if;

  select user_id into day_owner
  from public.workout_split_days
  where id = new.workout_split_day_id;

  if day_owner is null or day_owner <> new.user_id then
    new.workout_split_day_id := null;
  end if;

  return new;
end;
$$;

create trigger check_workout_split_day_owner
before insert or update on public.workouts
for each row execute function public.trg_check_workout_split_day_owner();
