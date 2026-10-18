-- Bodyweight and timed exercises.
--
-- Until now every set was a weight and a rep count, so a push-up or a plank
-- could only be logged by typing a made-up weight, which then became a "PR"
-- and counted toward volume. Each exercise now says what it measures:
--
--   weight_reps  a weight and reps (everything so far; a weighted variant such
--                as Weighted Pull-Up is its own weight_reps exercise, its
--                weight being the load added)
--   bodyweight   reps only (Push-Up, Pull-Up)
--   timed        a duration only (Plank, Dead Hang)
--
-- Each logged exercise snapshots the type it was logged as, so re-classifying
-- an exercise only changes new sessions: everything already logged keeps the
-- meaning it was logged with, and its existing PRs. Weighted PRs, true 1RMs and
-- Top Sets keep exactly their definitions and now only ever read weight_reps
-- sessions. Bodyweight and timed exercises get their own records: the most
-- reps, and the longest time.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.measurement_type as enum ('weight_reps', 'bodyweight', 'timed');

alter table public.exercises
  add column measurement_type public.measurement_type not null default 'weight_reps';

alter table public.workout_exercises
  add column measurement_type public.measurement_type not null default 'weight_reps';

alter table public.sets
  add column duration_seconds integer check (duration_seconds is null or duration_seconds > 0);

-- A logged exercise takes its exercise's type when it's added, and keeps it.
-- Never chosen by a client.
create function public.trg_workout_exercises_measurement_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.exercise_id is distinct from old.exercise_id then
    select e.measurement_type into new.measurement_type
    from public.exercises e
    where e.id = new.exercise_id;
  else
    new.measurement_type := old.measurement_type;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_workout_exercises_measurement_type() from public, anon, authenticated;

create trigger workout_exercises_measurement_type
before insert or update on public.workout_exercises
for each row execute function public.trg_workout_exercises_measurement_type();

-- ---------------------------------------------------------------------------
-- What a completed set may hold
-- ---------------------------------------------------------------------------
-- A completed weighted set has a weight and reps, a completed bodyweight set
-- has reps, and only a timed exercise's set may hold a duration. Deliberately
-- no stricter: an app build from before this change still logs a bodyweight
-- exercise with a weight and a timed one with weight and reps, and those
-- writes must keep working until it's replaced. A weight on a bodyweight set is
-- ignored everywhere, and a timed set without a duration sets no record.
create function public.trg_sets_match_measurement_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.measurement_type;
begin
  select we.measurement_type into v_type
  from public.workout_exercises we
  where we.id = new.workout_exercise_id;

  if new.duration_seconds is not null and v_type is distinct from 'timed' then
    raise exception 'only a timed exercise''s set has a duration' using errcode = '23514';
  end if;

  if new.completed_at is null then
    return new;
  end if;
  -- Nothing measured changed (a soft delete, a reorder): leave older rows be.
  if tg_op = 'UPDATE'
     and old.completed_at is not null
     and new.weight_kg is not distinct from old.weight_kg
     and new.reps is not distinct from old.reps
     and new.duration_seconds is not distinct from old.duration_seconds then
    return new;
  end if;

  if v_type = 'weight_reps' and (new.weight_kg is null or new.reps is null) then
    raise exception 'a completed weighted set needs a weight and reps' using errcode = '23514';
  end if;
  if v_type = 'bodyweight' and new.reps is null then
    raise exception 'a completed bodyweight set needs reps' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.trg_sets_match_measurement_type() from public, anon, authenticated;

create trigger sets_match_measurement_type
before insert or update on public.sets
for each row execute function public.trg_sets_match_measurement_type();

-- ---------------------------------------------------------------------------
-- Weighted PRs read weighted sessions only
-- ---------------------------------------------------------------------------
-- recompute_prs_for_exercise as of 20261018110000, with one more condition on
-- each of its four set lookups: the logged exercise is weight_reps. Every
-- existing logged exercise is weight_reps (the column's default), so no
-- existing PR changes.
create or replace function public.recompute_prs_for_exercise(p_user_id uuid, p_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
        and we.measurement_type = 'weight_reps'
        and s.completed_at is not null
        and s.weight_kg is not null
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
      and we.measurement_type = 'weight_reps'
      and s.completed_at is not null
      and s.weight_kg is not null
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
        and we.measurement_type = 'weight_reps'
        and s.completed_at is not null
        and s.weight_kg is not null
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
      and we.measurement_type = 'weight_reps'
      and s.completed_at is not null
      and s.weight_kg is not null
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

revoke execute on function public.recompute_prs_for_exercise(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bodyweight and timed records
-- ---------------------------------------------------------------------------
-- One row per (user, exercise): the most reps in a completed set of a
-- bodyweight session, and the longest completed set of a timed one. Derived
-- data only, like rep_prs: kept by recompute_records_for_exercise from the
-- triggers below, never written by a client. Cascades (rather than rep_prs's
-- restrict) so removing an exercise or a set row never has to clean these first.
create table public.rep_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  reps integer not null check (reps > 0),
  source_set_id uuid not null references public.sets (id) on delete cascade,
  achieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create table public.duration_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  duration_seconds integer not null check (duration_seconds > 0),
  source_set_id uuid not null references public.sets (id) on delete cascade,
  achieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create index rep_records_user_idx on public.rep_records (user_id);
create index duration_records_user_idx on public.duration_records (user_id);

alter table public.rep_records enable row level security;
alter table public.duration_records enable row level security;

create policy "rep_records_select_own"
on public.rep_records for select
to authenticated
using (user_id = auth.uid());

create policy "duration_records_select_own"
on public.duration_records for select
to authenticated
using (user_id = auth.uid());

-- An active trainer reads a client's records, as they do the client's PRs.
create policy "rep_records_trainer_select"
on public.rep_records for select
to authenticated
using (public.is_active_trainer_for(user_id));

create policy "duration_records_trainer_select"
on public.duration_records for select
to authenticated
using (public.is_active_trainer_for(user_id));

create function public.recompute_records_for_exercise(p_user_id uuid, p_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best record;
begin
  -- Most reps in a completed bodyweight set; ties go to the earliest.
  select s.reps, s.id as set_id, w.performed_at
  into v_best
  from public.sets s
  join public.workout_exercises we on we.id = s.workout_exercise_id
  join public.workouts w on w.id = we.workout_id
  where we.exercise_id = p_exercise_id
    and s.user_id = p_user_id
    and we.measurement_type = 'bodyweight'
    and s.completed_at is not null
    and s.reps is not null
    and s.deleted_at is null
    and we.deleted_at is null
    and w.deleted_at is null
  order by s.reps desc, w.performed_at asc, s.created_at asc
  limit 1;

  if not found then
    delete from public.rep_records where user_id = p_user_id and exercise_id = p_exercise_id;
  else
    insert into public.rep_records (user_id, exercise_id, reps, source_set_id, achieved_at)
    values (p_user_id, p_exercise_id, v_best.reps, v_best.set_id, v_best.performed_at)
    on conflict (user_id, exercise_id) do update
    set reps = excluded.reps,
        source_set_id = excluded.source_set_id,
        achieved_at = excluded.achieved_at,
        updated_at = now()
    where public.rep_records.reps is distinct from excluded.reps
       or public.rep_records.source_set_id is distinct from excluded.source_set_id;
  end if;

  -- Longest completed timed set; ties go to the earliest.
  select s.duration_seconds, s.id as set_id, w.performed_at
  into v_best
  from public.sets s
  join public.workout_exercises we on we.id = s.workout_exercise_id
  join public.workouts w on w.id = we.workout_id
  where we.exercise_id = p_exercise_id
    and s.user_id = p_user_id
    and we.measurement_type = 'timed'
    and s.completed_at is not null
    and s.duration_seconds is not null
    and s.deleted_at is null
    and we.deleted_at is null
    and w.deleted_at is null
  order by s.duration_seconds desc, w.performed_at asc, s.created_at asc
  limit 1;

  if not found then
    delete from public.duration_records where user_id = p_user_id and exercise_id = p_exercise_id;
  else
    insert into public.duration_records (user_id, exercise_id, duration_seconds, source_set_id, achieved_at)
    values (p_user_id, p_exercise_id, v_best.duration_seconds, v_best.set_id, v_best.performed_at)
    on conflict (user_id, exercise_id) do update
    set duration_seconds = excluded.duration_seconds,
        source_set_id = excluded.source_set_id,
        achieved_at = excluded.achieved_at,
        updated_at = now()
    where public.duration_records.duration_seconds is distinct from excluded.duration_seconds
       or public.duration_records.source_set_id is distinct from excluded.source_set_id;
  end if;
end;
$$;

revoke execute on function public.recompute_records_for_exercise(uuid, uuid) from public, anon, authenticated;

-- The same three moments as the PR triggers: a set changes, a logged exercise
-- is removed or restored, a workout is deleted, restored or re-dated.
create function public.trg_sets_recompute_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercise_id uuid;
  v_old_exercise_id uuid;
begin
  if tg_op = 'DELETE' then
    select we.exercise_id into v_exercise_id from public.workout_exercises we where we.id = old.workout_exercise_id;
    perform public.recompute_records_for_exercise(old.user_id, v_exercise_id);
    return null;
  end if;

  select we.exercise_id into v_exercise_id from public.workout_exercises we where we.id = new.workout_exercise_id;
  perform public.recompute_records_for_exercise(new.user_id, v_exercise_id);

  if tg_op = 'UPDATE' and (
    old.workout_exercise_id is distinct from new.workout_exercise_id
    or old.user_id is distinct from new.user_id
  ) then
    select we.exercise_id into v_old_exercise_id from public.workout_exercises we where we.id = old.workout_exercise_id;
    perform public.recompute_records_for_exercise(old.user_id, v_old_exercise_id);
  end if;
  return null;
end;
$$;

revoke all on function public.trg_sets_recompute_records() from public, anon, authenticated;

create trigger sets_recompute_records
after insert or update or delete on public.sets
for each row execute function public.trg_sets_recompute_records();

create function public.trg_workout_exercises_recompute_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is distinct from new.deleted_at then
    perform public.recompute_records_for_exercise(new.user_id, new.exercise_id);
  end if;
  return null;
end;
$$;

revoke all on function public.trg_workout_exercises_recompute_records() from public, anon, authenticated;

create trigger workout_exercises_recompute_records
after update of deleted_at on public.workout_exercises
for each row execute function public.trg_workout_exercises_recompute_records();

create function public.trg_workouts_recompute_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if old.deleted_at is distinct from new.deleted_at or old.performed_at is distinct from new.performed_at then
    for r in
      select distinct we.exercise_id
      from public.workout_exercises we
      where we.workout_id = new.id
    loop
      perform public.recompute_records_for_exercise(new.user_id, r.exercise_id);
    end loop;
  end if;
  return null;
end;
$$;

revoke all on function public.trg_workouts_recompute_records() from public, anon, authenticated;

create trigger workouts_recompute_records
after update of deleted_at, performed_at on public.workouts
for each row execute function public.trg_workouts_recompute_records();

-- ---------------------------------------------------------------------------
-- Trainer copies carry the type
-- ---------------------------------------------------------------------------
-- A trainer's custom exercise copied to a client keeps what it measures, and a
-- trainer-logged set may be reps-only or a duration. Otherwise unchanged from
-- 20261005200000_trainer_mode.sql / 20261005250000_live_sessions_and_groups.sql.
create or replace function public.trainer_log_workout(
  p_trainer_id uuid,
  p_client_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_id uuid;
  v_item jsonb;
  v_set jsonb;
  v_exercise public.exercises%rowtype;
  v_exercise_id uuid;
  v_workout_exercise_id uuid;
  v_performed_at timestamptz := (p_payload->>'performedAt')::timestamptz;
  v_order integer := 0;
begin
  if not exists (
    select 1
    from public.trainer_clients tc
    where tc.trainer_id = p_trainer_id
      and tc.client_id = p_client_id
      and tc.status = 'active'
  ) then
    raise exception 'not an active client of this trainer' using errcode = '42501';
  end if;

  if not public.has_trainer_entitlement(p_trainer_id) then
    raise exception 'trainer entitlement is not active' using errcode = '42501';
  end if;

  insert into public.workouts (user_id, name, performed_at, completed_at, notes, logged_by)
  values (
    p_client_id,
    p_payload->>'name',
    v_performed_at,
    nullif(p_payload->>'completedAt', '')::timestamptz,
    nullif(p_payload->>'notes', ''),
    p_trainer_id
  )
  returning id into v_workout_id;

  for v_item in select value from jsonb_array_elements(p_payload->'exercises') loop
    v_order := v_order + 1;

    select * into v_exercise
    from public.exercises
    where id = (v_item->>'exerciseId')::uuid;

    if not found or not v_exercise.is_active then
      raise exception 'exercise % is not available', v_item->>'exerciseId'
        using errcode = 'P0002';
    end if;

    if v_exercise.created_by is null or v_exercise.created_by = p_client_id then
      v_exercise_id := v_exercise.id;
    elsif v_exercise.created_by = p_trainer_id then
      select e.id into v_exercise_id
      from public.exercises e
      where e.created_by = p_client_id
        and lower(e.name) = lower(v_exercise.name);

      if v_exercise_id is null then
        insert into public.exercises (
          created_by, name, muscle_group, movement_type, logging_style, photo_url, measurement_type
        )
        values (
          p_client_id,
          v_exercise.name,
          v_exercise.muscle_group,
          v_exercise.movement_type,
          v_exercise.logging_style,
          v_exercise.photo_url,
          v_exercise.measurement_type
        )
        returning id into v_exercise_id;
      end if;
    else
      raise exception 'exercise % is not in this trainer''s library', v_exercise.id
        using errcode = '42501';
    end if;

    insert into public.workout_exercises (workout_id, exercise_id, order_index, logged_by)
    values (v_workout_id, v_exercise_id, v_order, p_trainer_id)
    returning id into v_workout_exercise_id;

    for v_set in select value from jsonb_array_elements(coalesce(v_item->'sets', '[]'::jsonb)) loop
      insert into public.sets (
        workout_exercise_id, set_index, side, weight_kg, reps, duration_seconds, completed_at, logged_by
      )
      values (
        v_workout_exercise_id,
        (v_set->>'setIndex')::integer,
        coalesce(v_set->>'side', 'none')::public.set_side,
        (v_set->>'weightKg')::numeric,
        (v_set->>'reps')::integer,
        (v_set->>'durationSeconds')::integer,
        v_performed_at,
        p_trainer_id
      );
    end loop;
  end loop;

  return v_workout_id;
end;
$$;

revoke all on function public.trainer_log_workout(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.trainer_log_workout(uuid, uuid, jsonb) to service_role;

create or replace function public.resolve_client_exercise(p_trainer uuid, p_client uuid, p_exercise uuid)
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

  insert into public.exercises (
    created_by, name, muscle_group, movement_type, logging_style, photo_url, measurement_type
  )
  values (
    p_client, v_ex.name, v_ex.muscle_group, v_ex.movement_type, v_ex.logging_style, v_ex.photo_url,
    v_ex.measurement_type
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.resolve_client_exercise(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_client_exercise(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The built-in library
-- ---------------------------------------------------------------------------
-- New sessions of these log what they really are; sessions already logged keep
-- their weighted snapshot and PRs.
update public.exercises
set measurement_type = 'bodyweight'
where created_by is null
  and name in (
    'Push-Up', 'Pull-Up', 'Sit-Up', 'Hanging Leg Raise', 'Nordic Hamstring Curl', 'Ab Wheel Rollout'
  );

update public.exercises
set measurement_type = 'timed'
where created_by is null
  and name = 'Plank';

-- A weighted pull-up is its own exercise (the weight is the load added), and a
-- dead hang is the other common timed hold.
insert into public.exercises (name, muscle_group, measurement_type) values
  ('Weighted Pull-Up', 'back', 'weight_reps'),
  ('Dead Hang', 'forearms', 'timed');
