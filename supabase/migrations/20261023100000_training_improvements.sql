-- ---------------------------------------------------------------------------
-- Training improvements: set slots, rep ranges, planned split days, phases
-- ---------------------------------------------------------------------------

-- 1. A removed set gives up its slot. Sets are soft-deleted (deleted_at), and
-- the slot rule counted removed rows too, so removing a workout's last set and
-- adding one again tried to reuse the removed set's number and failed. The
-- rule now holds among live sets only. Nothing renumbers sets in place, so it
-- no longer needs to be deferrable. A removed set is never restored on its
-- own (a whole workout is restored with its sets, which keep their slots).
alter table public.sets drop constraint sets_workout_exercise_id_set_index_side_key;

create unique index sets_live_slot_key
on public.sets (workout_exercise_id, set_index, side)
where deleted_at is null;

-- 2. A rep range may be a single number (5-5): the top of the range is then
-- that number.
alter table public.users drop constraint users_rep_range_check;
alter table public.users
  add constraint users_rep_range_check check (
    rep_range_min >= 1 and rep_range_max <= 50 and rep_range_min <= rep_range_max
  );

-- 3. Per-exercise progression settings: a rep range for this exercise only,
-- and the weight to add when it's time to go heavier (the equipment's step:
-- 2.5 kg plates, 5 lb dumbbells). Either can be left out. A range here wins
-- over the person's own; with none, theirs applies. Suggestions only: no set,
-- record or weight is ever changed from these.
create table public.exercise_progression_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  rep_range_min smallint,
  rep_range_max smallint,
  weight_increment_kg numeric(6, 2) check (weight_increment_kg is null or weight_increment_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id),
  check ((rep_range_min is null) = (rep_range_max is null)),
  check (
    rep_range_min is null
    or (rep_range_min >= 1 and rep_range_max <= 50 and rep_range_min <= rep_range_max)
  )
);

create trigger set_updated_at
before update on public.exercise_progression_settings
for each row execute function public.set_updated_at();

-- Only an exercise the person can see: a built-in one or their own.
create function public.trg_exercise_progression_settings_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.exercises e
    where e.id = new.exercise_id and (e.created_by is null or e.created_by = new.user_id)
  ) then
    raise exception 'exercise not available' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.trg_exercise_progression_settings_check() from public, anon, authenticated;

create trigger exercise_progression_settings_check
before insert or update on public.exercise_progression_settings
for each row execute function public.trg_exercise_progression_settings_check();

alter table public.exercise_progression_settings enable row level security;

create policy "exercise_progression_settings_own" on public.exercise_progression_settings
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. A split day's plan: the exercises to do that day, in order, each with
-- how many sets. Kept apart from the day itself (its name, its muscle
-- groups): the plan is what starting the day adds to the workout, and the
-- workout is its own record from then on, so changing a plan never changes
-- a workout already done.
create table public.workout_split_day_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_split_day_id uuid not null references public.workout_split_days (id) on delete cascade,
  -- Denormalized from workout_split_days.user_id, trigger-enforced.
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position smallint not null default 0,
  target_sets smallint not null default 3 check (target_sets between 1 and 20),
  created_at timestamptz not null default now()
);

create index workout_split_day_exercises_day_idx
on public.workout_split_day_exercises (workout_split_day_id);
create index workout_split_day_exercises_user_idx
on public.workout_split_day_exercises (user_id);

create function public.trg_set_split_day_exercise_owner()
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

  if not exists (
    select 1 from public.exercises e
    where e.id = new.exercise_id and (e.created_by is null or e.created_by = new.user_id)
  ) then
    raise exception 'exercise not available' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.trg_set_split_day_exercise_owner() from public, anon, authenticated;

create trigger set_split_day_exercise_owner
before insert or update on public.workout_split_day_exercises
for each row execute function public.trg_set_split_day_exercise_owner();

alter table public.workout_split_day_exercises enable row level security;

create policy "workout_split_day_exercises_own" on public.workout_split_day_exercises
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Training phases: a cut, a bulk, maintenance, or the person's own kind,
-- from a start date to an end date (none while it's going). One at a time,
-- and they never overlap, so every day belongs to at most one phase. Its
-- own targets, where it has them, are used in place of the daily targets
-- while it's active; the daily targets themselves are never changed.
create table public.training_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('cut', 'bulk', 'maintenance', 'custom')),
  name text check (name is null or char_length(btrim(name)) between 1 and 60),
  start_date date not null,
  end_date date,
  start_weight_kg numeric(5, 2) check (start_weight_kg is null or start_weight_kg > 0),
  target_weight_kg numeric(5, 2) check (target_weight_kg is null or target_weight_kg > 0),
  calories integer check (calories is null or calories > 0),
  protein_g numeric(6, 2) check (protein_g is null or protein_g > 0),
  carbs_g numeric(6, 2) check (carbs_g is null or carbs_g > 0),
  fat_g numeric(6, 2) check (fat_g is null or fat_g > 0),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (kind <> 'custom' or name is not null)
);

create index training_phases_user_idx on public.training_phases (user_id, start_date desc);

-- At most one phase still going per person.
create unique index training_phases_one_active
on public.training_phases (user_id)
where end_date is null;

create trigger set_updated_at
before update on public.training_phases
for each row execute function public.set_updated_at();

-- No two of a person's phases may share a day.
create function public.trg_training_phases_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An end before the start is the check constraint's to refuse.
  if new.end_date is not null and new.end_date < new.start_date then
    return new;
  end if;
  if exists (
    select 1 from public.training_phases p
    where p.user_id = new.user_id
      and p.id <> new.id
      and daterange(p.start_date, coalesce(p.end_date, 'infinity'::date), '[]')
        && daterange(new.start_date, coalesce(new.end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'phases cannot overlap' using errcode = '23P01';
  end if;
  return new;
end;
$$;

revoke all on function public.trg_training_phases_no_overlap() from public, anon, authenticated;

create trigger training_phases_no_overlap
before insert or update on public.training_phases
for each row execute function public.trg_training_phases_no_overlap();

alter table public.training_phases enable row level security;

create policy "training_phases_own" on public.training_phases
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
