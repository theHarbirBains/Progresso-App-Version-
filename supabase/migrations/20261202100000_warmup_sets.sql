-- Warm-up sets (explicitly requested): a set in a workout can be marked a warm-up, and a warm-up
-- counts toward nothing -- Harbir's call. It's shown in the workout and its history, marked W, but
-- is never a PR, a 1RM, a rep or duration record, a top set, part of volume or a set count, or
-- part of an achievement figure (a workout of warm-ups alone isn't a valid one).
--
-- Every function below is its latest definition with one more condition wherever it reads a
-- completed set -- `and not s.is_warmup` -- and nothing else changed. The set triggers already
-- recompute an exercise's records on any change to a set, so marking or unmarking a warm-up
-- puts its records right at once. Every existing set is a working set (the column's default), so
-- no record, figure or award changes as this applies.

alter table public.sets
  add column is_warmup boolean not null default false;

comment on column public.sets.is_warmup is
  'A warm-up set: shown with its workout, never counted -- no record, top set, volume, set count or achievement.';

-- recompute_prs_for_exercise: 4 completed-set condition(s) now leave warm-ups out.
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
        and not s.is_warmup
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
      and not s.is_warmup
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
        and not s.is_warmup
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
      and not s.is_warmup
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

-- recompute_records_for_exercise: 2 completed-set condition(s) now leave warm-ups out.
create or replace function public.recompute_records_for_exercise(p_user_id uuid, p_exercise_id uuid)
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
    and not s.is_warmup
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
    and not s.is_warmup
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

-- achievement_metrics: 2 completed-set condition(s) now leave warm-ups out.
create or replace function public.achievement_metrics(p_user uuid, p_zone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_zone text := public.achievement_zone(p_zone);
  v_totals record;
  v_workouts integer;
  v_weeks integer;
  v_food record;
  v_saved_meals integer;
  v_gain record;
  v_splits integer;
  v_muscles integer;
  v_styles integer;
  v_friends integer;
  v_likes_given integer;
  v_likes_received integer;
  v_muscle_volume jsonb;
  v_core_sets integer;
begin
  select * into v_totals from public.person_profile_totals(p_user, true);

  select count(*)::integer, count(distinct week_start)::integer into v_workouts, v_weeks
  from public.achievement_valid_workouts(p_user, v_zone);

  select
    count(*)::integer as entries,
    count(distinct (l.logged_at at time zone v_zone)::date)::integer as days,
    count(distinct coalesce(l.food_id::text, lower(btrim(l.food_name_snapshot))))::integer as foods
  into v_food
  from public.food_logs l
  where l.user_id = p_user;

  select count(*)::integer into v_saved_meals from public.saved_meals m where m.user_id = p_user;

  -- Like for like: each exercise's heaviest set at a rep count in its first session at that
  -- count, against its heaviest at that count in a later session. One exercise is one machine
  -- (a custom exercise is told apart by its photo, gym and grip), so changing machines is never
  -- counted as getting stronger.
  with done as (
    select we.exercise_id, s.reps, s.weight_kg, v.workout_id, w.performed_at
    from public.achievement_valid_workouts(p_user, v_zone) v
    join public.workouts w on w.id = v.workout_id
    join public.workout_exercises we on we.workout_id = v.workout_id and we.deleted_at is null
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where we.measurement_type = 'weight_reps'
      and s.completed_at is not null
      and not s.is_warmup
      and s.weight_kg > 0
      and s.reps between 1 and 30
  ),
  sessions as (
    select exercise_id, reps, workout_id, min(performed_at) as performed_at, max(weight_kg) as top
    from done
    group by exercise_id, reps, workout_id
  ),
  firsts as (
    select distinct on (exercise_id, reps) exercise_id, reps, workout_id, top
    from sessions
    order by exercise_id, reps, performed_at, workout_id
  ),
  gains as (
    select s.exercise_id, max((s.top - f.top) / f.top) as gain
    from sessions s
    join firsts f on f.exercise_id = s.exercise_id and f.reps = s.reps
    where s.workout_id <> f.workout_id
    group by s.exercise_id
  )
  select
    coalesce(round(max(gain) * 100, 2), 0) as best_pct,
    (count(*) filter (where gain >= 0.10))::integer as gained_10
  into v_gain
  from gains;

  select count(*)::integer into v_splits
  from public.workout_splits sp
  where sp.user_id = p_user
    and exists (select 1 from public.workout_split_days d where d.workout_split_id = sp.id);

  -- What they've trained, and how: each finished set once, to its exercise's own muscle group.
  with done as (
    select e.muscle_group, e.movement_type, we.measurement_type, v.group_id, v.logged_by,
      s.weight_kg, s.reps
    from public.achievement_valid_workouts(p_user, v_zone) v
    join public.workout_exercises we on we.workout_id = v.workout_id and we.deleted_at is null
    join public.exercises e on e.id = we.exercise_id
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where s.completed_at is not null
      and not s.is_warmup
  )
  select
    (
      select count(distinct muscle_group)::integer from done
      where muscle_group in (
        'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes',
        'calves', 'core'
      )
    ),
    (
      (exists (select 1 from done where measurement_type = 'weight_reps'))::integer
      + (exists (select 1 from done where measurement_type = 'bodyweight'))::integer
      + (exists (select 1 from done where measurement_type = 'timed'))::integer
      + (exists (select 1 from done where movement_type = 'unilateral'))::integer
      + (exists (select 1 from done where group_id is not null))::integer
      + (exists (select 1 from done where logged_by is not null))::integer
    ),
    coalesce((
      select jsonb_object_agg('muscle_volume_kg_' || muscle_group::text, volume)
      from (
        select muscle_group, sum(weight_kg * reps) as volume
        from done
        where measurement_type = 'weight_reps'
          and weight_kg is not null
          and reps is not null
          and reps > 0
        group by muscle_group
      ) by_muscle
    ), '{}'::jsonb),
    (select count(*)::integer from done where muscle_group = 'core')
  into v_muscles, v_styles, v_muscle_volume, v_core_sets;

  -- Friends follow each other, and nobody blocked either way counts.
  select count(*)::integer into v_friends
  from public.follows mine
  join public.follows theirs
    on theirs.follower_id = mine.followee_id and theirs.followee_id = mine.follower_id
  where mine.follower_id = p_user
    and mine.status = 'accepted'
    and theirs.status = 'accepted'
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = p_user and b.blocked_id = mine.followee_id)
         or (b.blocker_id = mine.followee_id and b.blocked_id = p_user)
    );

  select count(*)::integer into v_likes_given
  from public.workout_likes l
  join public.workouts w on w.id = l.workout_id
  where l.user_id = p_user and w.user_id <> p_user and w.deleted_at is null;

  -- Likes received only from people who train themselves (a finished workout of their own),
  -- each person counting for at most 10, and nobody blocked either way -- so a handful of
  -- accounts can't farm it.
  select coalesce(sum(least(per_person.n, 10)), 0)::integer into v_likes_received
  from (
    select l.user_id, count(*) as n
    from public.workout_likes l
    join public.workouts w on w.id = l.workout_id
    where w.user_id = p_user
      and w.deleted_at is null
      and l.user_id <> p_user
      and exists (
        select 1 from public.workouts own
        where own.user_id = l.user_id and own.completed_at is not null and own.deleted_at is null
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = p_user and b.blocked_id = l.user_id)
           or (b.blocker_id = l.user_id and b.blocked_id = p_user)
      )
    group by l.user_id
  ) per_person;

  return jsonb_build_object(
    'workouts', v_workouts,
    'weeks_trained', v_weeks,
    'prs', coalesce(v_totals.pr_count, 0),
    'volume_kg', coalesce(v_totals.total_volume_kg, 0),
    'exercises', coalesce(v_totals.exercise_count, 0),
    'food_entries', v_food.entries,
    'food_days', v_food.days,
    'unique_foods', v_food.foods,
    'saved_meals', v_saved_meals,
    'best_gain_pct', v_gain.best_pct,
    'exercises_gained_10', v_gain.gained_10,
    'splits', v_splits,
    'major_muscle_groups', v_muscles,
    'training_styles', v_styles,
    'core_sets', v_core_sets,
    'friends', v_friends,
    'likes_given', v_likes_given,
    'likes_received', v_likes_received
  ) || v_muscle_volume;
end;
$$;

-- achievement_valid_workouts: 1 completed-set condition(s) now leave warm-ups out.
create or replace function public.achievement_valid_workouts(p_user uuid, p_zone text)
returns table (workout_id uuid, week_start date, month_key text, group_id uuid, logged_by uuid)
language sql
stable
security definer
set search_path = public
as $$
  select w.id,
    date_trunc('week', w.performed_at at time zone p_zone)::date,
    to_char(w.performed_at at time zone p_zone, 'YYYY-MM'),
    w.group_id,
    w.logged_by
  from public.workouts w
  where w.user_id = p_user
    and w.completed_at is not null
    and w.deleted_at is null
    and exists (
      select 1
      from public.workout_exercises we
      join public.sets s on s.workout_exercise_id = we.id
      where we.workout_id = w.id
        and we.deleted_at is null
        and s.deleted_at is null
        and s.completed_at is not null
        and not s.is_warmup
    );
$$;

-- person_best_lifts: 1 completed-set condition(s) now leave warm-ups out.
create or replace function public.person_best_lifts(p_owner uuid, p_limit integer)
returns table (exercise_id uuid, weight_kg numeric, reps integer, performed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select best.exercise_id, best.weight_kg, best.reps, best.performed_at
  from (
    select distinct on (we.exercise_id)
      we.exercise_id, s.weight_kg, s.reps, w.performed_at
    from public.workouts w
    join public.workout_exercises we on we.workout_id = w.id and we.deleted_at is null
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where w.user_id = p_owner
      and w.completed_at is not null
      and w.deleted_at is null
      and w.logged_by is null
      and we.measurement_type = 'weight_reps'
      and s.completed_at is not null
      and not s.is_warmup
      and s.weight_kg is not null
      and s.reps is not null
      and s.reps > 0
    order by we.exercise_id, s.weight_kg desc, s.reps desc, w.performed_at desc
  ) best
  order by best.weight_kg desc, best.reps desc
  limit greatest(p_limit, 0);
$$;

-- person_exercise_bests: 1 completed-set condition(s) now leave warm-ups out.
create or replace function public.person_exercise_bests(p_owner uuid, p_include_trainer_logged boolean)
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
      and not s.is_warmup
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

-- person_exercise_history: 1 completed-set condition(s) now leave warm-ups out.
create or replace function public.person_exercise_history(
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
      and not s.is_warmup
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

-- person_profile_totals: 1 completed-set condition(s) now leave warm-ups out.
create or replace function public.person_profile_totals(p_owner uuid, p_include_trainer_logged boolean)
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
      and not s.is_warmup
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

-- trainer_log_workout: a set the trainer logs keeps its warm-up mark.
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
        and public.exercise_machine_key(e.name, e.gym, e.grip, e.attachment, e.photo_url, e.load_type, e.pulley, e.pulley_position, e.equipment) = public.exercise_machine_key(v_exercise.name, v_exercise.gym, v_exercise.grip, v_exercise.attachment, v_exercise.photo_url, v_exercise.load_type, v_exercise.pulley, v_exercise.pulley_position, v_exercise.equipment)
      order by e.is_active desc, e.created_at
      limit 1;

      if v_exercise_id is null then
        insert into public.exercises (
          created_by, name, muscle_group, movement_type, logging_style, photo_url, measurement_type,
          gym, feel_notes, attachment, load_type, pulley, grip, pulley_position, setup_details, equipment
        )
        values (
          p_client_id,
          v_exercise.name,
          v_exercise.muscle_group,
          v_exercise.movement_type,
          v_exercise.logging_style,
          v_exercise.photo_url,
          v_exercise.measurement_type,
          v_exercise.gym,
          v_exercise.feel_notes,
          v_exercise.attachment,
          v_exercise.load_type,
          v_exercise.pulley,
          v_exercise.grip,
          v_exercise.pulley_position,
          v_exercise.setup_details,
          v_exercise.equipment
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
        workout_exercise_id, set_index, side, weight_kg, reps, duration_seconds, completed_at, logged_by,
        is_warmup
      )
      values (
        v_workout_exercise_id,
        (v_set->>'setIndex')::integer,
        coalesce(v_set->>'side', 'none')::public.set_side,
        (v_set->>'weightKg')::numeric,
        (v_set->>'reps')::integer,
        (v_set->>'durationSeconds')::integer,
        v_performed_at,
        p_trainer_id,
        coalesce((v_set->>'isWarmup')::boolean, false)
      );
    end loop;
  end loop;

  return v_workout_id;
end;
$$;
