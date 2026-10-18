-- PR records come only from completed sets.
--
-- recompute_prs_for_exercise (20260823100008_pr_infrastructure.sql) predates
-- set completion. 20260907100001_set_completion_state.sql assumed an
-- incomplete set always has a null weight and reps, so the PR queries would
-- skip it on their own -- but un-ticking a set in the live workout clears
-- only completed_at and keeps the weight and reps it was logged with, so an
-- un-ticked set went on counting toward rep-count PRs and true 1RMs.
--
-- The function is otherwise unchanged: each of its four set lookups now also
-- requires completed_at and a weight, so a set counts only once it is ticked,
-- and a weightless set can never be picked as a "best" (a null sorts first in
-- a descending order). Sets that were completed keep exactly the PRs they had.
-- The set trigger already runs on every update, so ticking and un-ticking
-- recompute straight away.
create or replace function public.recompute_prs_for_exercise(p_user_id uuid, p_exercise_id uuid)
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

-- Same lock-down as the original: only the triggers (running as the function
-- owner) may call it.
revoke execute on function public.recompute_prs_for_exercise(uuid, uuid) from public, anon, authenticated;

-- Recompute once for every (user, exercise) that holds a record today. The
-- new rule only ever takes sets away, so a pair with no record can't gain
-- one; every pair that has one is brought in line now rather than whenever
-- that exercise is next logged.
do $$
declare
  r record;
begin
  for r in
    select user_id, exercise_id from public.rep_prs
    union
    select user_id, exercise_id from public.one_rep_maxes
  loop
    perform public.recompute_prs_for_exercise(r.user_id, r.exercise_id);
  end loop;
end;
$$;
