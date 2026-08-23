create table public.sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  -- Denormalized from workout_exercises.user_id; see the same note on
  -- workout_exercises.user_id. Always overwritten by trigger below.
  user_id uuid not null references auth.users (id) on delete cascade,
  set_index integer not null,
  -- Canonical storage unit. lb/kg is a display/input concern only, handled
  -- at the application boundary.
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  reps integer not null check (reps > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_exercise_id, set_index) deferrable initially deferred
);

create trigger set_updated_at
before update on public.sets
for each row execute function public.set_updated_at();

create index sets_workout_exercise_id_idx on public.sets (workout_exercise_id);
create index sets_user_id_idx on public.sets (user_id);

-- Same ownership-enforcement pattern as workout_exercises: user_id is always
-- derived from the parent workout_exercise's real owner, never trusted from
-- the client, so a spoofed user_id cannot be used to attach a set to
-- someone else's workout_exercise.
create function public.trg_set_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select we.user_id into new.user_id
  from public.workout_exercises we
  where we.id = new.workout_exercise_id;

  if new.user_id is null then
    raise exception 'workout_exercise % does not exist', new.workout_exercise_id;
  end if;

  return new;
end;
$$;

create trigger set_set_owner
before insert or update on public.sets
for each row execute function public.trg_set_set_owner();

alter table public.sets enable row level security;

create policy "sets_select_own"
on public.sets for select
to authenticated
using (user_id = auth.uid());

create policy "sets_insert_own"
on public.sets for insert
to authenticated
with check (user_id = auth.uid());

create policy "sets_update_own"
on public.sets for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- No delete policy: soft delete (deleted_at) via update, so the PR
-- recompute trigger always sees the change.
