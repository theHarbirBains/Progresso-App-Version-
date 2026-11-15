-- Ranked achievements and a person's records on every exercise
-- (apps/api/src/social/people.service.ts, apps/mobile/src/social/achievements.ts).
-- Nothing new is stored: every figure is worked out from the workouts, sets,
-- records and likes already kept, each time it's read.
--
-- * person_profile_totals -- now also the figures a profile's achievements are
--   ranked on: sets, reps, time trained, true 1RMs held, exercises done, the
--   biggest session, bodyweight reps, time on timed sets, group workouts,
--   months with 12+ workouts, weeks with 3+, and likes received and given.
--   Only from the workouts their followers can see (finished, not deleted, not
--   logged by a trainer) unless it's their own, as before. API-only.
-- * person_exercise_bests -- every exercise they've done, with its best set
--   (heaviest for weights, most reps for bodyweight, longest for timed) and how
--   many workouts it's in. API-only.
-- * person_exercise_history -- an exercise's top set from each of those
--   workouts, newest first. API-only.
-- * person_exercise_records -- the records they hold on one exercise (each
--   rep-count PR, a true 1RM, most reps, longest), from the workouts that count.
--   API-only.
-- * my_nutrition_totals -- the signed-in person's own nutrition figures for
--   their nutrition achievements: days logged (in their own time zone), foods
--   logged, protein and calories logged in all, recipes and saved meals. Read
--   under their own RLS, never anyone else's -- nobody else sees them.

-- The return type grows, so the function is replaced.
drop function public.person_profile_totals(uuid, boolean);

create function public.person_profile_totals(p_owner uuid, p_include_trainer_logged boolean)
returns table (
  total_volume_kg numeric,
  pr_count integer,
  best_month_workouts integer,
  total_sets integer,
  total_reps integer,
  training_minutes integer,
  one_rep_max_count integer,
  exercise_count integer,
  best_session_volume_kg numeric,
  bodyweight_reps integer,
  timed_seconds integer,
  group_workouts integer,
  committed_months integer,
  strong_weeks integer,
  likes_received integer,
  likes_given integer
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select w.id, w.performed_at, w.completed_at, w.group_id
    from public.workouts w
    where w.user_id = p_owner
      and w.completed_at is not null
      and w.deleted_at is null
      and (p_include_trainer_logged or w.logged_by is null)
  ),
  -- Every finished set that holds what its exercise records.
  done as (
    select v.id as workout_id, we.exercise_id, we.measurement_type, s.weight_kg, s.reps,
      s.duration_seconds
    from visible v
    join public.workout_exercises we on we.workout_id = v.id and we.deleted_at is null
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where s.completed_at is not null
      and case we.measurement_type
        when 'weight_reps' then s.weight_kg is not null and s.reps is not null and s.reps > 0
        when 'bodyweight' then s.reps is not null and s.reps > 0
        when 'timed' then s.duration_seconds is not null
      end
  ),
  lifted as (
    select workout_id, weight_kg * reps as volume
    from done
    where measurement_type = 'weight_reps'
  ),
  -- Every rep-count PR and true 1RM they hold now, from a workout that counts.
  held as (
    select records.kind
    from (
      select 'rep' as kind, r.source_set_id from public.rep_prs r where r.user_id = p_owner
      union all
      select 'max' as kind, o.source_set_id from public.one_rep_maxes o where o.user_id = p_owner
    ) records
    join public.sets s on s.id = records.source_set_id
    join public.workout_exercises we on we.id = s.workout_exercise_id
    join visible v on v.id = we.workout_id
  ),
  months as (
    select count(*) as n from visible group by date_trunc('month', performed_at)
  ),
  weeks as (
    select count(*) as n from visible group by date_trunc('week', performed_at)
  )
  select
    coalesce((select sum(volume) from lifted), 0) as total_volume_kg,
    (select count(*)::integer from held) as pr_count,
    coalesce((select max(n)::integer from months), 0) as best_month_workouts,
    (select count(*)::integer from done) as total_sets,
    coalesce((
      select sum(reps)::integer from done where measurement_type in ('weight_reps', 'bodyweight')
    ), 0) as total_reps,
    -- From start to finish, at most six hours a workout, so one left open overnight never counts
    -- as a night's training.
    coalesce((
      select sum(least(extract(epoch from (completed_at - performed_at)) / 60, 360))::integer
      from visible
      where completed_at > performed_at
    ), 0) as training_minutes,
    (select count(*)::integer from held where kind = 'max') as one_rep_max_count,
    (select count(distinct exercise_id)::integer from done) as exercise_count,
    coalesce((
      select max(total) from (select sum(volume) as total from lifted group by workout_id) sessions
    ), 0) as best_session_volume_kg,
    coalesce((
      select sum(reps)::integer from done where measurement_type = 'bodyweight'
    ), 0) as bodyweight_reps,
    coalesce((
      select sum(duration_seconds)::integer from done where measurement_type = 'timed'
    ), 0) as timed_seconds,
    (select count(*)::integer from visible where group_id is not null) as group_workouts,
    (select count(*)::integer from months where n >= 12) as committed_months,
    (select count(*)::integer from weeks where n >= 3) as strong_weeks,
    (
      select count(*)::integer
      from public.workout_likes l
      join visible v on v.id = l.workout_id
      where l.user_id <> p_owner
    ) as likes_received,
    (
      select count(*)::integer
      from public.workout_likes l
      join public.workouts w on w.id = l.workout_id
      where l.user_id = p_owner and w.user_id <> p_owner
    ) as likes_given;
$$;

revoke all on function public.person_profile_totals(uuid, boolean) from public, anon, authenticated;
grant execute on function public.person_profile_totals(uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Every exercise they've done, with its best set. An exercise is ranked by the
-- type it was last logged as (weights, bodyweight or timed), its best set the
-- heaviest (then most reps), the most reps, or the longest among those -- the
-- most-done exercises first.
-- ---------------------------------------------------------------------------
create function public.person_exercise_bests(p_owner uuid, p_include_trainer_logged boolean)
returns table (
  exercise_id uuid,
  measurement_type public.measurement_type,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  performed_at timestamptz,
  workouts integer,
  last_performed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select w.id, w.performed_at
    from public.workouts w
    where w.user_id = p_owner
      and w.completed_at is not null
      and w.deleted_at is null
      and (p_include_trainer_logged or w.logged_by is null)
  ),
  done as (
    select v.id as workout_id, v.performed_at, we.exercise_id, we.measurement_type, s.weight_kg,
      s.reps, s.duration_seconds
    from visible v
    join public.workout_exercises we on we.workout_id = v.id and we.deleted_at is null
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where s.completed_at is not null
      and case we.measurement_type
        when 'weight_reps' then s.weight_kg is not null and s.reps is not null and s.reps > 0
        when 'bodyweight' then s.reps is not null and s.reps > 0
        when 'timed' then s.duration_seconds is not null
      end
  ),
  latest as (
    select distinct on (d.exercise_id) d.exercise_id, d.measurement_type
    from done d
    order by d.exercise_id, d.performed_at desc
  ),
  best as (
    select distinct on (d.exercise_id) d.exercise_id, d.measurement_type, d.weight_kg, d.reps,
      d.duration_seconds, d.performed_at
    from done d
    join latest l on l.exercise_id = d.exercise_id and l.measurement_type = d.measurement_type
    order by d.exercise_id,
      case when d.measurement_type = 'weight_reps' then d.weight_kg end desc nulls last,
      case when d.measurement_type <> 'timed' then d.reps end desc nulls last,
      case when d.measurement_type = 'timed' then d.duration_seconds end desc nulls last,
      d.performed_at desc
  ),
  counts as (
    select d.exercise_id, count(distinct d.workout_id)::integer as workouts,
      max(d.performed_at) as last_performed_at
    from done d
    group by d.exercise_id
  )
  select b.exercise_id, b.measurement_type,
    case when b.measurement_type = 'weight_reps' then b.weight_kg end,
    case when b.measurement_type <> 'timed' then b.reps end,
    case when b.measurement_type = 'timed' then b.duration_seconds end,
    b.performed_at, c.workouts, c.last_performed_at
  from best b
  join counts c on c.exercise_id = b.exercise_id
  order by c.workouts desc, b.weight_kg desc nulls last, c.last_performed_at desc;
$$;

revoke all on function public.person_exercise_bests(uuid, boolean) from public, anon, authenticated;
grant execute on function public.person_exercise_bests(uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- One exercise's top set from each workout that counts, newest first: the
-- heaviest (then most reps) for weights, the most reps for bodyweight, the
-- longest for timed.
-- ---------------------------------------------------------------------------
create function public.person_exercise_history(
  p_owner uuid,
  p_exercise uuid,
  p_include_trainer_logged boolean,
  p_limit integer
)
returns table (
  workout_id uuid,
  performed_at timestamptz,
  measurement_type public.measurement_type,
  weight_kg numeric,
  reps integer,
  duration_seconds integer
)
language sql
stable
security definer
set search_path = public
as $$
  select top.workout_id, top.performed_at, top.measurement_type,
    case when top.measurement_type = 'weight_reps' then top.weight_kg end,
    case when top.measurement_type <> 'timed' then top.reps end,
    case when top.measurement_type = 'timed' then top.duration_seconds end
  from (
    select distinct on (w.id) w.id as workout_id, w.performed_at, we.measurement_type,
      s.weight_kg, s.reps, s.duration_seconds
    from public.workouts w
    join public.workout_exercises we on we.workout_id = w.id and we.deleted_at is null
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where w.user_id = p_owner
      and w.completed_at is not null
      and w.deleted_at is null
      and (p_include_trainer_logged or w.logged_by is null)
      and we.exercise_id = p_exercise
      and s.completed_at is not null
      and case we.measurement_type
        when 'weight_reps' then s.weight_kg is not null and s.reps is not null and s.reps > 0
        when 'bodyweight' then s.reps is not null and s.reps > 0
        when 'timed' then s.duration_seconds is not null
      end
    order by w.id,
      case when we.measurement_type = 'weight_reps' then s.weight_kg end desc nulls last,
      case when we.measurement_type <> 'timed' then s.reps end desc nulls last,
      case when we.measurement_type = 'timed' then s.duration_seconds end desc nulls last
  ) top
  order by top.performed_at desc
  limit greatest(p_limit, 0);
$$;

revoke all on function public.person_exercise_history(uuid, uuid, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.person_exercise_history(uuid, uuid, boolean, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- The records they hold on one exercise, from the workouts that count: each
-- rep-count PR ('rep'), a true 1RM ('max'), most reps ('most_reps') and
-- longest ('longest').
-- ---------------------------------------------------------------------------
create function public.person_exercise_records(
  p_owner uuid,
  p_exercise uuid,
  p_include_trainer_logged boolean
)
returns table (
  kind text,
  reps integer,
  weight_kg numeric,
  duration_seconds integer,
  achieved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select records.kind, records.reps, records.weight_kg, records.duration_seconds,
    records.achieved_at
  from (
    select 'rep' as kind, r.reps, r.best_weight_kg as weight_kg, null::integer as duration_seconds,
      r.achieved_at, r.source_set_id
    from public.rep_prs r
    where r.user_id = p_owner and r.exercise_id = p_exercise
    union all
    select 'max', 1, o.weight_kg, null, o.achieved_at, o.source_set_id
    from public.one_rep_maxes o
    where o.user_id = p_owner and o.exercise_id = p_exercise
    union all
    select 'most_reps', m.reps, null, null, m.achieved_at, m.source_set_id
    from public.rep_records m
    where m.user_id = p_owner and m.exercise_id = p_exercise
    union all
    select 'longest', null, null, d.duration_seconds, d.achieved_at, d.source_set_id
    from public.duration_records d
    where d.user_id = p_owner and d.exercise_id = p_exercise
  ) records
  join public.sets s on s.id = records.source_set_id
  join public.workout_exercises we on we.id = s.workout_exercise_id
  join public.workouts w on w.id = we.workout_id
  where w.completed_at is not null
    and w.deleted_at is null
    and (p_include_trainer_logged or w.logged_by is null)
  order by records.kind, records.reps nulls last;
$$;

revoke all on function public.person_exercise_records(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.person_exercise_records(uuid, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- The signed-in person's own nutrition figures. Security invoker: it reads
-- under their own RLS, so it can only ever count their own logs, foods and
-- meals. A day is a day where they live (p_time_zone, the phone's own; an
-- unknown one counts in UTC).
-- ---------------------------------------------------------------------------
create function public.my_nutrition_totals(p_time_zone text)
returns table (
  days_logged integer,
  foods_logged integer,
  protein_g numeric,
  calories numeric,
  recipes integer,
  saved_meals integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with zone as (
    select coalesce(
      (select name from pg_catalog.pg_timezone_names where name = p_time_zone limit 1),
      'UTC'
    ) as name
  ),
  logs as (
    select l.logged_at, l.protein_g, l.calories
    from public.food_logs l
    where l.user_id = auth.uid()
  )
  select
    (
      select count(distinct (l.logged_at at time zone z.name)::date)::integer
      from logs l cross join zone z
    ) as days_logged,
    (select count(*)::integer from logs) as foods_logged,
    coalesce((select sum(protein_g) from logs), 0) as protein_g,
    coalesce((select sum(calories) from logs), 0) as calories,
    (
      select count(*)::integer
      from public.foods f
      where f.created_by = auth.uid() and f.recipe_servings is not null
    ) as recipes,
    (select count(*)::integer from public.saved_meals m where m.user_id = auth.uid()) as saved_meals;
$$;

revoke all on function public.my_nutrition_totals(text) from public, anon;
grant execute on function public.my_nutrition_totals(text) to authenticated;
