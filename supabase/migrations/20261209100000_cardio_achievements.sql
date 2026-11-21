-- Cardio achievements (explicitly requested): six for the cardio a workout now holds
-- (20261208100000_workout_cardio.sql), in a Cardio category of their own -- public, like every
-- training achievement, and awarded by the server from what's really logged like the rest.
--
-- * Heart Starter (single) -- a first workout with cardio.
-- * Hybrid Athlete (single) -- lifting and cardio in the same workout.
-- * Cross Trainer (single) -- five different kinds of cardio.
-- * Engine Room -- workouts with cardio: 5 to 1,000.
-- * Long Haul -- minutes of cardio: 1 hour to 1,000 hours.
-- * Mile Marker -- distance covered, set in miles like weight is set in pounds (stored in km, a new
--   'km' unit the app shows in miles or kilometres): 5 to 5,000 miles.
--
-- Only workouts that count (achievement_valid_workouts) count their cardio, and each activity
-- adds at most 4 hours and 100 km, so one mistyped entry can't carry a level. Cardio still adds
-- nothing to sets, volume, records or a muscle group. As with every level, an award is never
-- taken back. A level is new rows here; rebalanced against `npm run db:simulate`.

alter table public.achievement_definitions
  drop constraint achievement_definitions_category_check,
  add constraint achievement_definitions_category_check check (
    category in (
      'workouts', 'consistency', 'strength', 'nutrition', 'progression', 'exploration',
      'volume', 'muscles', 'cardio', 'social'
    )
  ),
  drop constraint achievement_definitions_unit_check,
  add constraint achievement_definitions_unit_check check (unit in ('count', 'kg', 'percent', 'km'));

insert into public.achievement_definitions
  (id, category, kind, title, description, icon, metric, unit, goal_label, visibility, sort)
values
  ('heart-starter', 'cardio', 'single', 'Heart Starter', 'Finish your first workout with cardio', 'heart', 'cardio_workouts', 'count', 'workouts with cardio', 'public', 330),
  ('hybrid-athlete', 'cardio', 'single', 'Hybrid Athlete', 'Lift and do cardio in the same workout', 'git-merge', 'hybrid_workouts', 'count', 'workouts with both', 'public', 340),
  ('cross-trainer', 'cardio', 'single', 'Cross Trainer', 'Do five different kinds of cardio', 'grid', 'cardio_kinds', 'count', 'kinds of cardio', 'public', 350),
  ('engine-room', 'cardio', 'levels', 'Engine Room', 'Do cardio in different workouts', 'wind', 'cardio_workouts', 'count', 'workouts with cardio', 'public', 360),
  ('long-haul', 'cardio', 'levels', 'Long Haul', 'Do cardio for longer in all', 'clock', 'cardio_minutes', 'count', 'minutes of cardio', 'public', 370),
  ('mile-marker', 'cardio', 'levels', 'Mile Marker', 'Cover distance on your cardio', 'map', 'cardio_distance_km', 'km', 'covered', 'public', 380);

insert into public.achievement_levels (achievement_id, level, goal, ap)
values
  ('heart-starter', 1, 1, 25),
  ('hybrid-athlete', 1, 1, 50),
  ('cross-trainer', 1, 5, 150),
  ('engine-room', 1, 5, 30),
  ('engine-room', 2, 10, 50),
  ('engine-room', 3, 25, 75),
  ('engine-room', 4, 50, 125),
  ('engine-room', 5, 100, 200),
  ('engine-room', 6, 250, 350),
  ('engine-room', 7, 500, 600),
  ('engine-room', 8, 1000, 1000),
  ('long-haul', 1, 60, 20),
  ('long-haul', 2, 300, 40),
  ('long-haul', 3, 600, 75),
  ('long-haul', 4, 1500, 125),
  ('long-haul', 5, 3000, 200),
  ('long-haul', 6, 6000, 300),
  ('long-haul', 7, 15000, 450),
  ('long-haul', 8, 30000, 650),
  ('long-haul', 9, 60000, 1000),
  ('mile-marker', 1, 8.0467, 20),
  ('mile-marker', 2, 40.2336, 40),
  ('mile-marker', 3, 160.9344, 75),
  ('mile-marker', 4, 402.336, 125),
  ('mile-marker', 5, 804.672, 200),
  ('mile-marker', 6, 1609.344, 300),
  ('mile-marker', 7, 4023.36, 450),
  ('mile-marker', 8, 8046.72, 700);

-- achievement_metrics: its latest definition (20261207100000_drop_sets.sql) with cardio's figures.
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
  v_cardio record;
  v_hybrid integer;
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
      and not s.is_drop
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
      s.weight_kg, s.reps, s.is_drop
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
    (select count(*)::integer from done where muscle_group = 'core' and not is_drop)
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

  -- Cardio (20261208100000_workout_cardio.sql), in the workouts that count: how many had any,
  -- its time and distance -- each activity counted up to 4 hours and 100 km, so one typo'd day
  -- can't carry a level -- the different kinds done, and the workouts that had lifting too.
  select
    count(distinct c.workout_id)::integer as workouts,
    coalesce(floor(sum(least(c.duration_seconds, 14400)) / 60.0), 0)::integer as minutes,
    coalesce(round(sum(least(coalesce(c.distance_m, 0), 100000)) / 1000.0, 3), 0) as distance_km,
    count(distinct c.activity)::integer as kinds
  into v_cardio
  from public.achievement_valid_workouts(p_user, v_zone) v
  join public.workout_cardio c on c.workout_id = v.workout_id;

  select count(*)::integer into v_hybrid
  from public.achievement_valid_workouts(p_user, v_zone) v
  where exists (select 1 from public.workout_cardio c where c.workout_id = v.workout_id)
    and exists (
      select 1
      from public.workout_exercises we
      join public.sets s on s.workout_exercise_id = we.id
      where we.workout_id = v.workout_id
        and we.deleted_at is null
        and s.deleted_at is null
        and s.completed_at is not null
        and not s.is_warmup
    );

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
    'likes_received', v_likes_received,
    'cardio_workouts', v_cardio.workouts,
    'cardio_minutes', v_cardio.minutes,
    'cardio_distance_km', v_cardio.distance_km,
    'cardio_kinds', v_cardio.kinds,
    'hybrid_workouts', v_hybrid
  ) || v_muscle_volume;
end;
$$;
