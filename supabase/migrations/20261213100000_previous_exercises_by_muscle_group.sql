-- Previous exercises by muscle group (explicitly requested): what Add Exercise shows first in a
-- live workout -- the exercises a person did the last time they trained each muscle group.
--
-- For each muscle group, a person's latest finished workouts that trained it (up to
-- p_sessions), and in each, the exercises of that group they did with their working sets. The
-- app keeps those from the latest day (a morning and an evening session are one day) and
-- shows the exercises by their own id, so a variation is never swapped for a look-alike.
--
-- What counts, the same as everywhere else in the app:
--   * A finished workout (completed_at set, not deleted): a live, cancelled or deleted one never.
--   * An exercise trains its own muscle group (exercises.muscle_group) and no other: a built-in's
--     secondary muscles are illustration only, as for the muscle filter, Weekly Summary and
--     achievements.
--   * It was done if it has a finished working set: a warm-up or a drop set alone doesn't count,
--     and only working sets come back.
--   * Every workout that's the person's own counts, whoever logged it: a trainer's logging for a
--     client is the client's history (logged_by says who logged it).
--
-- Security invoker: it reads only what the caller already can under RLS -- their own workouts
-- (an active trainer, their client's), each exercise only where they can read it.

create or replace function public.previous_exercises_by_muscle_group(
  p_user_id uuid,
  p_sessions integer default 3
)
returns table (
  muscle_group public.muscle_group,
  workout_id uuid,
  performed_at timestamptz,
  logged_by uuid,
  workout_exercise_id uuid,
  exercise_id uuid,
  order_index integer,
  measurement_type text,
  sets jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with trained as (
    select
      e.muscle_group,
      w.id as workout_id,
      w.performed_at,
      w.logged_by,
      we.id as workout_exercise_id,
      we.exercise_id,
      we.order_index,
      we.measurement_type::text as measurement_type
    from public.workouts w
    join public.workout_exercises we on we.workout_id = w.id and we.deleted_at is null
    join public.exercises e on e.id = we.exercise_id
    where w.user_id = p_user_id
      and w.completed_at is not null
      and w.deleted_at is null
      and exists (
        select 1
        from public.sets s
        where s.workout_exercise_id = we.id
          and s.completed_at is not null
          and s.deleted_at is null
          and not s.is_warmup
          and not s.is_drop
      )
  ),
  sessions as (
    select
      t.muscle_group,
      t.workout_id,
      row_number() over (
        partition by t.muscle_group
        order by t.performed_at desc, t.workout_id
      ) as recency
    from (select distinct muscle_group, workout_id, performed_at from trained) t
  )
  select
    t.muscle_group,
    t.workout_id,
    t.performed_at,
    t.logged_by,
    t.workout_exercise_id,
    t.exercise_id,
    t.order_index,
    t.measurement_type,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'set_index', s.set_index,
            'side', s.side,
            'weight_kg', s.weight_kg,
            'reps', s.reps,
            'duration_seconds', s.duration_seconds,
            'completed_at', s.completed_at
          )
          order by s.set_index, s.side
        ),
        '[]'::jsonb
      )
      from public.sets s
      where s.workout_exercise_id = t.workout_exercise_id
        and s.completed_at is not null
        and s.deleted_at is null
        and not s.is_warmup
        and not s.is_drop
    ) as sets
  from trained t
  join sessions ss
    on ss.muscle_group = t.muscle_group
   and ss.workout_id = t.workout_id
  where ss.recency <= greatest(1, least(coalesce(p_sessions, 3), 10))
  order by t.muscle_group, t.performed_at desc, t.order_index;
$$;

revoke all on function public.previous_exercises_by_muscle_group(uuid, integer) from public, anon;
grant execute on function public.previous_exercises_by_muscle_group(uuid, integer) to authenticated;
