-- Achievement Points (AP) and lifetime ranks (apps/mobile/src/achievements).
--
-- * achievement_definitions -- the catalogue: each achievement's id, category,
--   what it takes (a figure and its threshold), its AP, whether it's earned
--   once or every week / month, and whether others may see it (nutrition
--   achievements are only ever their owner's). Read by anyone signed in;
--   written only here.
-- * achievement_awards -- one row per award: who, which achievement, which
--   period ('once', 'W:2026-11-09' -- the week's Monday -- or 'M:2026-11'),
--   the AP awarded and when. A person's lifetime AP is the sum of their awards,
--   so it can never go down; their rank is worked out from it in the app.
--   Rows are never changed and never written from the app: only
--   award_achievements below inserts them, and the unique key makes every
--   award happen at most once however often it runs.
-- * award_achievements -- works out every figure from the real tables (the
--   same ones Progress and profiles read; person_profile_totals for volume,
--   records and exercises) and awards what's been reached, in the person's own
--   time zone, one person at a time. award_my_achievements is the signed-in
--   person's own way to run it; my_achievement_metrics their progress.
-- * audit_achievements -- every award of a person's, whether it would still be
--   reached today, and the AP total, for support.
-- * users.time_zone (the phone's, kept by award_my_achievements, so weeks and
--   days are the person's own) and users.show_rank (Settings > Privacy: whether
--   people who open your profile see your rank).
--
-- Awards are permanent: deleting a workout later never takes AP back. Only a
-- valid workout counts -- finished, not deleted, with at least one finished
-- set. Weeks run Monday to Sunday where the person lives; with no weekly
-- workout goal set, it's 3.

alter table public.users
  add column time_zone text check (time_zone is null or char_length(time_zone) between 1 and 64),
  add column show_rank boolean not null default true;

create table public.achievement_definitions (
  id text primary key check (id ~ '^[a-z0-9-]{1,48}$'),
  category text not null check (
    category in (
      'workouts', 'consistency', 'strength', 'nutrition', 'progression', 'exploration',
      'volume', 'social'
    )
  ),
  title text not null check (char_length(title) between 1 and 40),
  description text not null check (char_length(description) between 1 and 120),
  icon text not null,
  ap integer not null check (ap > 0),
  repeats text not null default 'once' check (repeats in ('once', 'weekly', 'monthly')),
  -- The figure it's measured on (achievement_metrics' key) and how much of it it takes.
  metric text not null,
  threshold numeric not null check (threshold > 0),
  -- 'count', 'kg' (weight, shown in the person's unit) or 'percent'.
  unit text not null default 'count' check (unit in ('count', 'kg', 'percent')),
  -- Private ones (nutrition) are never shown to anyone but their owner.
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  sort integer not null,
  unique (sort)
);

alter table public.achievement_definitions enable row level security;
revoke all on public.achievement_definitions from anon, authenticated;
grant select on public.achievement_definitions to authenticated;
create policy "achievement_definitions_read"
on public.achievement_definitions for select
to authenticated
using (true);

create table public.achievement_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievement_definitions (id),
  period_key text not null default 'once' check (period_key ~ '^(once|W:\d{4}-\d{2}-\d{2}|M:\d{4}-\d{2})$'),
  ap integer not null check (ap > 0),
  awarded_at timestamptz not null default now(),
  unique (user_id, achievement_id, period_key)
);

create index achievement_awards_user_idx on public.achievement_awards (user_id, awarded_at desc);

alter table public.achievement_awards enable row level security;
revoke all on public.achievement_awards from anon, authenticated;
grant select on public.achievement_awards to authenticated;
create policy "achievement_awards_select_own"
on public.achievement_awards for select
to authenticated
using (user_id = auth.uid());
-- Not even the API changes or removes one; an account's go with it when it's deleted.
revoke update, delete on public.achievement_awards from service_role;

create function public.trg_achievement_awards_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'An achievement award is never changed';
end;
$$;

create trigger achievement_awards_immutable
before update on public.achievement_awards
for each row execute function public.trg_achievement_awards_immutable();

-- ---------------------------------------------------------------------------
-- The catalogue.
-- ---------------------------------------------------------------------------
insert into public.achievement_definitions
  (id, category, title, description, icon, ap, repeats, metric, threshold, unit, visibility, sort)
values
  -- Workout milestones
  ('first-steps', 'workouts', 'First Steps', 'Finish your first workout', 'play', 25, 'once', 'workouts', 1, 'count', 'public', 10),
  ('getting-started', 'workouts', 'Getting Started', 'Finish 5 workouts', 'activity', 50, 'once', 'workouts', 5, 'count', 'public', 20),
  ('building-momentum', 'workouts', 'Building Momentum', 'Finish 10 workouts', 'activity', 75, 'once', 'workouts', 10, 'count', 'public', 30),
  ('dedicated', 'workouts', 'Dedicated', 'Finish 25 workouts', 'activity', 125, 'once', 'workouts', 25, 'count', 'public', 40),
  ('committed', 'workouts', 'Committed', 'Finish 50 workouts', 'activity', 200, 'once', 'workouts', 50, 'count', 'public', 50),
  ('iron-habit', 'workouts', 'Iron Habit', 'Finish 100 workouts', 'activity', 350, 'once', 'workouts', 100, 'count', 'public', 60),
  ('relentless', 'workouts', 'Relentless', 'Finish 250 workouts', 'activity', 600, 'once', 'workouts', 250, 'count', 'public', 70),
  ('veteran', 'workouts', 'Veteran', 'Finish 500 workouts', 'shield', 1000, 'once', 'workouts', 500, 'count', 'public', 80),
  ('legendary-volume', 'workouts', 'Legendary Volume', 'Finish 1,000 workouts', 'star', 2000, 'once', 'workouts', 1000, 'count', 'public', 90),
  -- Consistency
  ('first-week', 'consistency', 'First Week', 'Meet your weekly workout goal', 'calendar', 50, 'once', 'goal_weeks', 1, 'count', 'public', 110),
  ('weekly-warrior', 'consistency', 'Weekly Warrior', 'Meet your weekly workout goal -- every week you do', 'check-circle', 25, 'weekly', 'week_goal', 1, 'count', 'public', 120),
  ('monthly-dedication', 'consistency', 'Monthly Dedication', 'Meet your weekly goal every week of a month', 'award', 75, 'monthly', 'month_goal', 1, 'count', 'public', 130),
  ('training-champion', 'consistency', 'Training Champion', 'Finish 5 workouts in a calendar month', 'zap', 50, 'monthly', 'month_workouts', 5, 'count', 'public', 140),
  -- Strength (records held, from the PR triggers)
  ('first-pr', 'strength', 'First PR', 'Set your first personal record', 'trending-up', 50, 'once', 'prs', 1, 'count', 'public', 210),
  ('record-breaker', 'strength', 'Record Breaker', 'Hold 5 personal records', 'trending-up', 100, 'once', 'prs', 5, 'count', 'public', 220),
  ('strength-builder', 'strength', 'Strength Builder', 'Hold 10 personal records', 'trending-up', 150, 'once', 'prs', 10, 'count', 'public', 230),
  ('powerhouse', 'strength', 'Powerhouse', 'Hold 25 personal records', 'zap', 300, 'once', 'prs', 25, 'count', 'public', 240),
  ('stronger-every-day', 'strength', 'Stronger Every Day', 'Hold 50 personal records', 'zap', 500, 'once', 'prs', 50, 'count', 'public', 250),
  ('elite-progression', 'strength', 'Elite Progression', 'Hold 100 personal records', 'award', 1000, 'once', 'prs', 100, 'count', 'public', 260),
  ('strength-master', 'strength', 'Strength Master', 'Hold 250 personal records', 'star', 2000, 'once', 'prs', 250, 'count', 'public', 270),
  -- Nutrition (only ever their owner's)
  ('first-bite', 'nutrition', 'First Bite', 'Log your first food', 'coffee', 25, 'once', 'food_entries', 1, 'count', 'private', 310),
  ('food-tracker', 'nutrition', 'Food Tracker', 'Log food on 7 different days', 'book-open', 50, 'once', 'food_days', 7, 'count', 'private', 320),
  ('nutrition-routine', 'nutrition', 'Nutrition Routine', 'Log food on 30 different days', 'book-open', 150, 'once', 'food_days', 30, 'count', 'private', 330),
  ('dedicated-tracker', 'nutrition', 'Dedicated Tracker', 'Log food on 100 different days', 'book-open', 350, 'once', 'food_days', 100, 'count', 'private', 340),
  ('nutrition-veteran', 'nutrition', 'Nutrition Veteran', 'Log food on 365 different days', 'book', 750, 'once', 'food_days', 365, 'count', 'private', 350),
  ('meal-prepper', 'nutrition', 'Meal Prepper', 'Save your first meal', 'package', 50, 'once', 'saved_meals', 1, 'count', 'private', 360),
  ('food-explorer', 'nutrition', 'Food Explorer', 'Log 50 different foods', 'compass', 150, 'once', 'unique_foods', 50, 'count', 'private', 370),
  ('nutrition-expert', 'nutrition', 'Nutrition Expert', 'Log 250 different foods', 'compass', 400, 'once', 'unique_foods', 250, 'count', 'private', 380),
  ('nutrition-focus', 'nutrition', 'Nutrition Focus', 'Log food on all 7 days of a week -- every week you do', 'check-square', 25, 'weekly', 'week_food_days', 7, 'count', 'private', 390),
  -- Progression (one exercise, one rep count, like for like)
  ('first-improvement', 'progression', 'First Improvement', 'Lift 5% more on an exercise, for the same reps', 'arrow-up-right', 50, 'once', 'best_gain_pct', 5, 'percent', 'public', 410),
  ('level-up', 'progression', 'Level Up', 'Lift 10% more on an exercise, for the same reps', 'arrow-up-right', 100, 'once', 'best_gain_pct', 10, 'percent', 'public', 420),
  ('major-breakthrough', 'progression', 'Major Breakthrough', 'Lift 20% more on an exercise, for the same reps', 'arrow-up-right', 250, 'once', 'best_gain_pct', 20, 'percent', 'public', 430),
  ('progressive-athlete', 'progression', 'Progressive Athlete', 'Lift 10% more on 5 different exercises', 'bar-chart-2', 300, 'once', 'exercises_gained_10', 5, 'count', 'public', 440),
  ('strength-across-the-board', 'progression', 'Strength Across the Board', 'Lift 10% more on 10 different exercises', 'bar-chart-2', 600, 'once', 'exercises_gained_10', 10, 'count', 'public', 450),
  -- Exploration
  ('exercise-explorer', 'exploration', 'Exercise Explorer', 'Do 10 different exercises', 'compass', 50, 'once', 'exercises', 10, 'count', 'public', 510),
  ('variety', 'exploration', 'Variety', 'Do 25 different exercises', 'compass', 100, 'once', 'exercises', 25, 'count', 'public', 520),
  ('movement-master', 'exploration', 'Movement Master', 'Do 50 different exercises', 'compass', 200, 'once', 'exercises', 50, 'count', 'public', 530),
  ('exercise-collector', 'exploration', 'Exercise Collector', 'Do 100 different exercises', 'grid', 400, 'once', 'exercises', 100, 'count', 'public', 540),
  ('split-creator', 'exploration', 'Split Creator', 'Make your first workout split', 'layers', 50, 'once', 'splits', 1, 'count', 'public', 550),
  ('split-specialist', 'exploration', 'Split Specialist', 'Make 3 different workout splits', 'layers', 150, 'once', 'splits', 3, 'count', 'public', 560),
  ('full-body-athlete', 'exploration', 'Full Body Athlete', 'Train every major muscle group', 'user', 200, 'once', 'major_muscle_groups', 10, 'count', 'public', 570),
  ('all-round-athlete', 'exploration', 'All-Round Athlete', 'Train 5 ways: weighted, bodyweight, timed, single-side, in a group or with a trainer', 'shuffle', 300, 'once', 'training_styles', 5, 'count', 'public', 580),
  -- Training volume (thresholds in kg, set in pounds)
  ('first-1000', 'volume', 'First 1,000', 'Lift 1,000 lb in all', 'layers', 50, 'once', 'volume_kg', 453.59237, 'kg', 'public', 610),
  ('heavy-lifter', 'volume', 'Heavy Lifter', 'Lift 10,000 lb in all', 'layers', 100, 'once', 'volume_kg', 4535.9237, 'kg', 'public', 620),
  ('volume-builder', 'volume', 'Volume Builder', 'Lift 50,000 lb in all', 'layers', 200, 'once', 'volume_kg', 22679.6185, 'kg', 'public', 630),
  ('100k-club', 'volume', '100K Club', 'Lift 100,000 lb in all', 'layers', 300, 'once', 'volume_kg', 45359.237, 'kg', 'public', 640),
  ('quarter-million', 'volume', 'Quarter Million', 'Lift 250,000 lb in all', 'layers', 500, 'once', 'volume_kg', 113398.0925, 'kg', 'public', 650),
  ('half-million', 'volume', 'Half Million', 'Lift 500,000 lb in all', 'layers', 750, 'once', 'volume_kg', 226796.185, 'kg', 'public', 660),
  ('million-club', 'volume', 'Million Club', 'Lift 1,000,000 lb in all', 'award', 1500, 'once', 'volume_kg', 453592.37, 'kg', 'public', 670),
  ('five-million-club', 'volume', 'Five Million Club', 'Lift 5,000,000 lb in all', 'star', 2500, 'once', 'volume_kg', 2267961.85, 'kg', 'public', 680),
  -- Social (friends: people you follow who follow you back)
  ('first-connection', 'social', 'First Connection', 'Make your first friend -- you follow each other', 'user-plus', 25, 'once', 'friends', 1, 'count', 'public', 710),
  ('social-circle', 'social', 'Social Circle', 'Have 5 friends', 'users', 75, 'once', 'friends', 5, 'count', 'public', 720),
  ('fitness-community', 'social', 'Fitness Community', 'Have 10 friends', 'users', 150, 'once', 'friends', 10, 'count', 'public', 730),
  ('workout-supporter', 'social', 'Workout Supporter', 'Like 10 friends'' workouts', 'heart', 50, 'once', 'likes_given', 10, 'count', 'public', 740),
  ('encourager', 'social', 'Encourager', 'Like 50 friends'' workouts', 'heart', 150, 'once', 'likes_given', 50, 'count', 'public', 750),
  ('community-favourite', 'social', 'Community Favourite', 'Get 25 likes on your workouts', 'thumbs-up', 100, 'once', 'likes_received', 25, 'count', 'public', 760),
  ('community-builder', 'social', 'Community Builder', 'Get 100 likes on your workouts', 'thumbs-up', 300, 'once', 'likes_received', 100, 'count', 'public', 770);

-- ---------------------------------------------------------------------------
-- Helpers.
-- ---------------------------------------------------------------------------

/** A known time zone name, or UTC. */
create function public.achievement_zone(p_zone text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select name from pg_catalog.pg_timezone_names where name = p_zone limit 1),
    'UTC'
  );
$$;

/**
 * A person's valid workouts -- finished, not deleted, with at least one finished set (their
 * own, a trainer's logging and group workouts all count) -- each with its local week (the
 * Monday) and month.
 */
create function public.achievement_valid_workouts(p_user uuid, p_zone text)
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
    );
$$;

revoke all on function public.achievement_valid_workouts(uuid, text) from public, anon, authenticated;

/**
 * Every figure the catalogue is measured on, for one person, as of now in their own time zone.
 * Volume, records held and exercises come from person_profile_totals (their own view: a
 * trainer's logging counts) -- the same figures their profile shows.
 */
create function public.achievement_metrics(p_user uuid, p_zone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_zone text := public.achievement_zone(p_zone);
  v_goal integer;
  v_totals record;
  v_workouts integer;
  v_goal_weeks integer;
  v_week_workouts integer;
  v_month_workouts integer;
  v_food record;
  v_week_food_days integer;
  v_saved_meals integer;
  v_gain record;
  v_splits integer;
  v_muscles integer;
  v_styles integer;
  v_friends integer;
  v_likes_given integer;
  v_likes_received integer;
  v_now timestamp := now() at time zone v_zone;
begin
  select coalesce(u.workout_frequency_days, 3) into v_goal from public.users u where u.id = p_user;
  v_goal := coalesce(v_goal, 3);

  select * into v_totals from public.person_profile_totals(p_user, true);

  select count(*)::integer into v_workouts
  from public.achievement_valid_workouts(p_user, v_zone);

  select count(*)::integer into v_goal_weeks
  from (
    select week_start from public.achievement_valid_workouts(p_user, v_zone)
    group by week_start having count(*) >= v_goal
  ) weeks;

  select
    count(*) filter (where week_start = date_trunc('week', v_now)::date)::integer,
    count(*) filter (where month_key = to_char(v_now, 'YYYY-MM'))::integer
  into v_week_workouts, v_month_workouts
  from public.achievement_valid_workouts(p_user, v_zone);

  select
    count(*)::integer as entries,
    count(distinct (l.logged_at at time zone v_zone)::date)::integer as days,
    count(distinct coalesce(l.food_id::text, lower(btrim(l.food_name_snapshot))))::integer as foods
  into v_food
  from public.food_logs l
  where l.user_id = p_user;

  select count(distinct (l.logged_at at time zone v_zone)::date)::integer into v_week_food_days
  from public.food_logs l
  where l.user_id = p_user
    and date_trunc('week', l.logged_at at time zone v_zone)::date = date_trunc('week', v_now)::date;

  select count(*)::integer into v_saved_meals from public.saved_meals m where m.user_id = p_user;

  -- Like for like: each exercise's heaviest set at a rep count in its first session at that
  -- count, against its heaviest ever at that count, from a later session. One exercise is one
  -- machine (a custom exercise is told apart by its photo, gym and grip), so changing machines
  -- is never counted as getting stronger.
  with done as (
    select we.exercise_id, s.reps, s.weight_kg, v.workout_id, w.performed_at
    from public.achievement_valid_workouts(p_user, v_zone) v
    join public.workouts w on w.id = v.workout_id
    join public.workout_exercises we on we.workout_id = v.workout_id and we.deleted_at is null
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where we.measurement_type = 'weight_reps'
      and s.completed_at is not null
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

  -- What they've trained, and how: the major muscle groups and the ways of training.
  with done as (
    select e.muscle_group, e.movement_type, we.measurement_type, v.group_id, v.logged_by
    from public.achievement_valid_workouts(p_user, v_zone) v
    join public.workout_exercises we on we.workout_id = v.workout_id and we.deleted_at is null
    join public.exercises e on e.id = we.exercise_id
    where exists (
      select 1 from public.sets s
      where s.workout_exercise_id = we.id and s.deleted_at is null and s.completed_at is not null
    )
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
    )
  into v_muscles, v_styles;

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
    'goal', v_goal,
    'goal_weeks', v_goal_weeks,
    'week_workouts', v_week_workouts,
    'month_workouts', v_month_workouts,
    'prs', coalesce(v_totals.pr_count, 0),
    'food_entries', v_food.entries,
    'food_days', v_food.days,
    'unique_foods', v_food.foods,
    'week_food_days', v_week_food_days,
    'saved_meals', v_saved_meals,
    'best_gain_pct', v_gain.best_pct,
    'exercises_gained_10', v_gain.gained_10,
    'exercises', coalesce(v_totals.exercise_count, 0),
    'splits', v_splits,
    'major_muscle_groups', v_muscles,
    'training_styles', v_styles,
    'volume_kg', coalesce(v_totals.total_volume_kg, 0),
    'friends', v_friends,
    'likes_given', v_likes_given,
    'likes_received', v_likes_received
  );
end;
$$;

revoke all on function public.achievement_metrics(uuid, text) from public, anon, authenticated;
grant execute on function public.achievement_metrics(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Awarding: everything reached and not yet awarded, at most once each (once,
-- or once a period). One person at a time; safe to run again and again.
-- ---------------------------------------------------------------------------
create function public.award_achievements(p_user uuid, p_zone text)
returns table (achievement_id text, period_key text, ap integer, awarded_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_zone text := public.achievement_zone(p_zone);
  v_metrics jsonb;
  v_goal integer;
begin
  -- Two runs for the same person at once take turns; the unique key does the rest.
  perform pg_advisory_xact_lock(hashtextextended('achievements:' || p_user::text, 0));

  v_metrics := public.achievement_metrics(p_user, v_zone);
  v_goal := (v_metrics ->> 'goal')::integer;

  return query
  with valid as (
    select * from public.achievement_valid_workouts(p_user, v_zone)
  ),
  goal_weeks as (
    select week_start from valid group by week_start having count(*) >= v_goal
  ),
  -- A month whose every week (the weeks starting in it) met the goal.
  goal_months as (
    select to_char(m.month_start, 'YYYY-MM') as month_key
    from (select distinct date_trunc('month', week_start)::date as month_start from goal_weeks) m
    where not exists (
      select 1
      from generate_series(
        m.month_start + ((8 - extract(isodow from m.month_start)::integer) % 7),
        (m.month_start + interval '1 month' - interval '1 day')::date,
        interval '7 days'
      ) monday
      where monday::date not in (select week_start from goal_weeks)
    )
  ),
  busy_months as (
    select month_key from valid group by month_key
    having count(*) >= (select threshold from public.achievement_definitions where id = 'training-champion')
  ),
  food_weeks as (
    select date_trunc('week', l.logged_at at time zone v_zone)::date as week_start
    from public.food_logs l
    where l.user_id = p_user
    group by 1
    having count(distinct (l.logged_at at time zone v_zone)::date)
      >= (select threshold from public.achievement_definitions where id = 'nutrition-focus')
  ),
  reached as (
    select d.id, 'once'::text as period, d.ap
    from public.achievement_definitions d
    where d.repeats = 'once'
      and coalesce((v_metrics ->> d.metric)::numeric, 0) >= d.threshold
    union all
    select d.id, 'W:' || to_char(g.week_start, 'YYYY-MM-DD'), d.ap
    from goal_weeks g, public.achievement_definitions d where d.id = 'weekly-warrior'
    union all
    select d.id, 'M:' || g.month_key, d.ap
    from goal_months g, public.achievement_definitions d where d.id = 'monthly-dedication'
    union all
    select d.id, 'M:' || b.month_key, d.ap
    from busy_months b, public.achievement_definitions d where d.id = 'training-champion'
    union all
    select d.id, 'W:' || to_char(f.week_start, 'YYYY-MM-DD'), d.ap
    from food_weeks f, public.achievement_definitions d where d.id = 'nutrition-focus'
  ),
  inserted as (
    insert into public.achievement_awards (user_id, achievement_id, period_key, ap)
    select p_user, r.id, r.period, r.ap from reached r
    on conflict on constraint achievement_awards_user_id_achievement_id_period_key_key do nothing
    returning achievement_awards.achievement_id, achievement_awards.period_key,
      achievement_awards.ap, achievement_awards.awarded_at
  )
  select i.achievement_id, i.period_key, i.ap, i.awarded_at from inserted i;
end;
$$;

revoke all on function public.award_achievements(uuid, text) from public, anon, authenticated;
grant execute on function public.award_achievements(uuid, text) to service_role;

/**
 * The signed-in person's own awards, with the phone's time zone (kept on their row, so their
 * weeks stay theirs). Returns what this run newly awarded.
 */
create function public.award_my_achievements(p_time_zone text)
returns table (achievement_id text, period_key text, ap integer, awarded_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_zone text := public.achievement_zone(p_time_zone);
begin
  if v_user is null then
    raise exception 'Sign in to earn achievements';
  end if;
  update public.users set time_zone = v_zone
  where id = v_user and time_zone is distinct from v_zone;
  return query select * from public.award_achievements(v_user, v_zone);
end;
$$;

revoke all on function public.award_my_achievements(text) from public, anon;
grant execute on function public.award_my_achievements(text) to authenticated;

/** The signed-in person's own figures, for their progress toward each achievement. */
create function public.my_achievement_metrics(p_time_zone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your achievements';
  end if;
  return public.achievement_metrics(auth.uid(), p_time_zone);
end;
$$;

revoke all on function public.my_achievement_metrics(text) from public, anon;
grant execute on function public.my_achievement_metrics(text) to authenticated;

/** A person's lifetime AP and how many awards make it up (the API's, for profiles). */
create function public.achievement_summary(p_user uuid)
returns table (points integer, awards integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(a.ap), 0)::integer, count(*)::integer
  from public.achievement_awards a
  where a.user_id = p_user;
$$;

revoke all on function public.achievement_summary(uuid) from public, anon, authenticated;
grant execute on function public.achievement_summary(uuid) to service_role;

/**
 * For support: every award of a person's, whether its one-time requirement is still reached
 * today (a repeatable one's week or month is history, so it always stands), and the running AP
 * total in the order they were awarded. Recalculating is running award_achievements again --
 * it only ever adds what's missing.
 */
create function public.audit_achievements(p_user uuid)
returns table (
  achievement_id text,
  period_key text,
  ap integer,
  awarded_at timestamptz,
  still_reached boolean,
  running_points integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_metrics jsonb := public.achievement_metrics(
    p_user,
    (select u.time_zone from public.users u where u.id = p_user)
  );
begin
  return query
  select a.achievement_id, a.period_key, a.ap, a.awarded_at,
    d.repeats <> 'once' or coalesce((v_metrics ->> d.metric)::numeric, 0) >= d.threshold,
    (sum(a.ap) over (order by a.awarded_at, a.id))::integer
  from public.achievement_awards a
  join public.achievement_definitions d on d.id = a.achievement_id
  where a.user_id = p_user
  order by a.awarded_at, a.id;
end;
$$;

revoke all on function public.audit_achievements(uuid) from public, anon, authenticated;
grant execute on function public.audit_achievements(uuid) to service_role;
