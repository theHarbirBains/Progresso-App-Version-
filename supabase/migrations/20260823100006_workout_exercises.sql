create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  -- Restrict, not cascade: an exercise referenced by any workout can only be
  -- deactivated, never hard-deleted, so historical workouts stay valid.
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  -- Denormalized from workouts.user_id so RLS policies below can compare
  -- directly instead of subquerying through workouts on every row.
  -- Always overwritten by trg_set_owner_from_workout below; never trust the
  -- client-supplied value.
  user_id uuid not null references auth.users (id) on delete cascade,
  order_index integer not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_id, order_index) deferrable initially deferred
);

create trigger set_updated_at
before update on public.workout_exercises
for each row execute function public.set_updated_at();

create index workout_exercises_workout_id_idx on public.workout_exercises (workout_id);
create index workout_exercises_exercise_id_idx on public.workout_exercises (exercise_id);
create index workout_exercises_user_id_idx on public.workout_exercises (user_id);

-- Forces user_id to match the parent workout's real owner, regardless of
-- what the client sends. Combined with the RLS with-check below, this makes
-- it structurally impossible to attach a workout_exercise to someone else's
-- workout: even a lied-about user_id gets corrected to the workout's real
-- owner, which then fails the with-check unless it equals auth.uid().
create function public.trg_set_workout_exercise_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select w.user_id into new.user_id
  from public.workouts w
  where w.id = new.workout_id;

  if new.user_id is null then
    raise exception 'workout % does not exist', new.workout_id;
  end if;

  return new;
end;
$$;

create trigger set_workout_exercise_owner
before insert or update on public.workout_exercises
for each row execute function public.trg_set_workout_exercise_owner();

alter table public.workout_exercises enable row level security;

create policy "workout_exercises_select_own"
on public.workout_exercises for select
to authenticated
using (user_id = auth.uid());

create policy "workout_exercises_insert_own"
on public.workout_exercises for insert
to authenticated
with check (user_id = auth.uid());

create policy "workout_exercises_update_own"
on public.workout_exercises for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- No delete policy: soft delete (deleted_at) via update. Child sets are not
-- themselves marked deleted, but the PR recompute function (see the PR
-- infrastructure migration) treats a set as non-qualifying whenever its
-- parent workout_exercise or workout is soft-deleted, so PRs stay correct.
