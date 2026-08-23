-- Rep-count PRs: heaviest weight ever logged at a given rep count (reps >= 2).
-- Reps = 1 is handled exclusively by one_rep_maxes below, so a single-rep set
-- is never double-counted as both "the 1-rep PR" and "the true 1RM".
create table public.rep_prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  reps integer not null check (reps >= 2),
  best_weight_kg numeric(6, 2) not null check (best_weight_kg > 0),
  source_set_id uuid not null references public.sets (id) on delete restrict,
  achieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id, reps)
);

create index rep_prs_user_exercise_idx on public.rep_prs (user_id, exercise_id);

-- True 1RM: only ever derived from an actual logged set of exactly 1 rep.
-- Never estimated from higher-rep sets.
create table public.one_rep_maxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  source_set_id uuid not null references public.sets (id) on delete restrict,
  achieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create index one_rep_maxes_user_exercise_idx on public.one_rep_maxes (user_id, exercise_id);

alter table public.rep_prs enable row level security;
alter table public.one_rep_maxes enable row level security;

-- Read-only for the owning user. These tables are exclusively
-- system-maintained (see the recompute function below) — no client insert,
-- update, or delete policy exists for either table.
create policy "rep_prs_select_own"
on public.rep_prs for select
to authenticated
using (user_id = auth.uid());

create policy "one_rep_maxes_select_own"
on public.one_rep_maxes for select
to authenticated
using (user_id = auth.uid());

-- Full recompute of a single (user, exercise) pair's PR state, derived fresh
-- from sets every time rather than incrementally patched. This is the only
-- place PR logic lives: every trigger below just calls this function, so
-- correctness only has to be proven once. A set qualifies only when it, its
-- parent workout_exercise, and its parent workout are all not soft-deleted.
create function public.recompute_prs_for_exercise(p_user_id uuid, p_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Rep-count PRs (reps >= 2): drop any rep-count that no longer has a
  -- qualifying set, then upsert the current best per rep-count.
  delete from public.rep_prs rp
  where rp.user_id = p_user_id
    and rp.exercise_id = p_exercise_id
    and not exists (
      select 1
      from public.sets s
      join public.workout_exercises we on we.id = s.workout_exercise_id
      join public.workouts w on w.id = we.workout_id
      where we.exercise_id = p_exercise_id
        and s.user_id = p_user_id
        and s.reps = rp.reps
        and s.deleted_at is null
        and we.deleted_at is null
        and w.deleted_at is null
    );

  insert into public.rep_prs (user_id, exercise_id, reps, best_weight_kg, source_set_id, achieved_at)
  select p_user_id, p_exercise_id, best.reps, best.weight_kg, best.set_id, best.achieved_at
  from (
    select distinct on (s.reps)
      s.reps,
      s.weight_kg,
      s.id as set_id,
      w.performed_at as achieved_at
    from public.sets s
    join public.workout_exercises we on we.id = s.workout_exercise_id
    join public.workouts w on w.id = we.workout_id
    where we.exercise_id = p_exercise_id
      and s.user_id = p_user_id
      and s.reps >= 2
      and s.deleted_at is null
      and we.deleted_at is null
      and w.deleted_at is null
    order by s.reps, s.weight_kg desc, w.performed_at asc, s.created_at asc
  ) best
  on conflict (user_id, exercise_id, reps) do update
  set
    best_weight_kg = excluded.best_weight_kg,
    source_set_id = excluded.source_set_id,
    achieved_at = excluded.achieved_at,
    updated_at = now()
  where public.rep_prs.best_weight_kg is distinct from excluded.best_weight_kg
     or public.rep_prs.source_set_id is distinct from excluded.source_set_id;

  -- True 1RM (reps = 1): same pattern, single row.
  delete from public.one_rep_maxes om
  where om.user_id = p_user_id
    and om.exercise_id = p_exercise_id
    and not exists (
      select 1
      from public.sets s
      join public.workout_exercises we on we.id = s.workout_exercise_id
      join public.workouts w on w.id = we.workout_id
      where we.exercise_id = p_exercise_id
        and s.user_id = p_user_id
        and s.reps = 1
        and s.deleted_at is null
        and we.deleted_at is null
        and w.deleted_at is null
    );

  insert into public.one_rep_maxes (user_id, exercise_id, weight_kg, source_set_id, achieved_at)
  select p_user_id, p_exercise_id, best.weight_kg, best.set_id, best.achieved_at
  from (
    select s.weight_kg, s.id as set_id, w.performed_at as achieved_at
    from public.sets s
    join public.workout_exercises we on we.id = s.workout_exercise_id
    join public.workouts w on w.id = we.workout_id
    where we.exercise_id = p_exercise_id
      and s.user_id = p_user_id
      and s.reps = 1
      and s.deleted_at is null
      and we.deleted_at is null
      and w.deleted_at is null
    order by s.weight_kg desc, w.performed_at asc, s.created_at asc
    limit 1
  ) best
  on conflict (user_id, exercise_id) do update
  set
    weight_kg = excluded.weight_kg,
    source_set_id = excluded.source_set_id,
    achieved_at = excluded.achieved_at,
    updated_at = now()
  where public.one_rep_maxes.weight_kg is distinct from excluded.weight_kg
     or public.one_rep_maxes.source_set_id is distinct from excluded.source_set_id;
end;
$$;

-- Not reachable via RPC: only trigger invocations run as the function owner,
-- which is what makes the security-definer writes above safe. A direct
-- client call would let anyone force a recompute for an arbitrary user.
revoke execute on function public.recompute_prs_for_exercise(uuid, uuid) from public, anon, authenticated;

create function public.trg_sets_recompute_prs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercise_id uuid;
  v_old_exercise_id uuid;
begin
  if TG_OP = 'DELETE' then
    select we.exercise_id into v_exercise_id from public.workout_exercises we where we.id = OLD.workout_exercise_id;
    perform public.recompute_prs_for_exercise(OLD.user_id, v_exercise_id);
    return null;
  end if;

  select we.exercise_id into v_exercise_id from public.workout_exercises we where we.id = NEW.workout_exercise_id;
  perform public.recompute_prs_for_exercise(NEW.user_id, v_exercise_id);

  if TG_OP = 'UPDATE' and OLD.workout_exercise_id is distinct from NEW.workout_exercise_id then
    select we.exercise_id into v_old_exercise_id from public.workout_exercises we where we.id = OLD.workout_exercise_id;
    if v_old_exercise_id is distinct from v_exercise_id then
      perform public.recompute_prs_for_exercise(OLD.user_id, v_old_exercise_id);
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.trg_sets_recompute_prs() from public, anon, authenticated;

create trigger sets_recompute_prs
after insert or update or delete on public.sets
for each row execute function public.trg_sets_recompute_prs();

create function public.trg_workout_exercises_recompute_prs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.deleted_at is distinct from NEW.deleted_at then
    perform public.recompute_prs_for_exercise(NEW.user_id, NEW.exercise_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.trg_workout_exercises_recompute_prs() from public, anon, authenticated;

create trigger workout_exercises_recompute_prs
after update of deleted_at on public.workout_exercises
for each row execute function public.trg_workout_exercises_recompute_prs();

create function public.trg_workouts_recompute_prs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if OLD.deleted_at is distinct from NEW.deleted_at or OLD.performed_at is distinct from NEW.performed_at then
    for r in
      select distinct we.exercise_id
      from public.workout_exercises we
      where we.workout_id = NEW.id
    loop
      perform public.recompute_prs_for_exercise(NEW.user_id, r.exercise_id);
    end loop;
  end if;
  return null;
end;
$$;

revoke execute on function public.trg_workouts_recompute_prs() from public, anon, authenticated;

create trigger workouts_recompute_prs
after update of deleted_at, performed_at on public.workouts
for each row execute function public.trg_workouts_recompute_prs();
