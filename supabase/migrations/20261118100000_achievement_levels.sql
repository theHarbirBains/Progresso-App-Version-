-- Achievement levels (apps/mobile/src/achievements): single-unlock and multi-level
-- achievements, each level its own goal and its own AP, higher levels worth more and taking
-- more; and no more weekly or monthly repeatable achievements -- a person who misses a week
-- and makes it up later in the year loses nothing.
--
-- * achievement_definitions -- each achievement once: 'single' (one level) or 'levels'; the
--   figure it's measured on, its unit and what its goals count ('workouts', 'lifted on biceps');
--   who may see it. Read by anyone signed in, written only by migrations.
-- * achievement_levels -- each achievement's levels: its goal (in the figure's own unit -- kg
--   for weight, set in pounds) and the AP it awards. Any number of levels; a new level or a new
--   achievement is only new rows.
-- * achievement_awards -- the AP ledger: one row per person, achievement and level, with the AP
--   and when. Never changed, never written from the app; the unique key makes every level award
--   at most once. Lifetime AP is their sum, so it never goes down.
-- * achievement_progress -- where each person stands on each achievement: the figure as of the
--   last award run and the level reached (never lower than one awarded). Their own to read.
-- * award_achievements -- works every figure out from the real tables, awards each level reached
--   and not yet awarded, and keeps achievement_progress; one person at a time, safe to run again
--   and again. award_my_achievements is the signed-in person's own way to run it.
--
-- Muscle-group achievements count the weight x reps of each finished weighted set toward its
-- exercise's own muscle group (an exercise has one), so a set counts once, to one muscle; core is
-- counted in finished sets of any kind, since most core work is bodyweight or timed. Consistency
-- is weeks trained in all, never in a row.
--
-- The awards table is replaced. Every award made so far is carried over as it was -- the same
-- achievement, its AP and when -- which each can be, being a single-unlock achievement that
-- stays exactly the same; anything that couldn't be carried over unchanged stops this before
-- anything is touched. The two functions nothing calls any more (my_nutrition_totals,
-- person_best_lifts) go too.

create temporary table achievement_awards_carried on commit drop as
select user_id, achievement_id, period_key, ap, awarded_at from public.achievement_awards;

drop function if exists public.award_my_achievements(text);
drop function if exists public.award_achievements(uuid, text);
drop function if exists public.audit_achievements(uuid);
drop function if exists public.my_achievement_metrics(text);
drop function if exists public.achievement_metrics(uuid, text);
drop function if exists public.my_nutrition_totals(text);
drop function if exists public.person_best_lifts(uuid, integer);

drop table public.achievement_awards;
delete from public.achievement_definitions;

alter table public.achievement_definitions
  drop column ap,
  drop column repeats,
  drop column threshold,
  drop constraint achievement_definitions_category_check,
  add constraint achievement_definitions_category_check check (
    category in (
      'workouts', 'consistency', 'strength', 'nutrition', 'progression', 'exploration',
      'volume', 'muscles', 'social'
    )
  ),
  add column kind text not null default 'levels' check (kind in ('single', 'levels')),
  -- What a goal's figure counts, after it: '250 workouts', '125,000 lb lifted on biceps'.
  add column goal_label text not null default '' check (char_length(goal_label) <= 40);

create table public.achievement_levels (
  achievement_id text not null references public.achievement_definitions (id) on delete cascade,
  level smallint not null check (level >= 1),
  goal numeric not null check (goal > 0),
  ap integer not null check (ap > 0),
  primary key (achievement_id, level)
);

alter table public.achievement_levels enable row level security;
revoke all on public.achievement_levels from anon, authenticated;
grant select on public.achievement_levels to authenticated;
create policy "achievement_levels_read"
on public.achievement_levels for select
to authenticated
using (true);

create table public.achievement_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  level smallint not null,
  ap integer not null check (ap > 0),
  awarded_at timestamptz not null default now(),
  unique (user_id, achievement_id, level),
  foreign key (achievement_id, level) references public.achievement_levels (achievement_id, level)
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

create trigger achievement_awards_immutable
before update on public.achievement_awards
for each row execute function public.trg_achievement_awards_immutable();

create table public.achievement_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievement_definitions (id) on delete cascade,
  value numeric not null default 0,
  level smallint not null default 0 check (level >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievement_progress enable row level security;
revoke all on public.achievement_progress from anon, authenticated;
grant select on public.achievement_progress to authenticated;
create policy "achievement_progress_select_own"
on public.achievement_progress for select
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The catalogue. Muscle goals are chest's ladder scaled by how heavy that muscle's lifts
-- usually are, rounded:
-- Pecs Appeal: 2,500 lb, 25,000 lb, 100,000 lb, 300,000 lb, 750,000 lb, 1,500,000 lb, 3,000,000 lb, 6,000,000 lb
-- Back Attack: 3,000 lb, 30,000 lb, 125,000 lb, 300,000 lb, 800,000 lb, 1,500,000 lb, 3,000,000 lb, 7,500,000 lb
-- Boulder Shoulders: 1,500 lb, 15,000 lb, 60,000 lb, 200,000 lb, 500,000 lb, 1,000,000 lb, 2,000,000 lb, 4,000,000 lb
-- Guns Blazin': 1,000 lb, 10,000 lb, 40,000 lb, 125,000 lb, 300,000 lb, 600,000 lb, 1,250,000 lb, 2,500,000 lb
-- Tri Hard: 1,250 lb, 12,500 lb, 50,000 lb, 150,000 lb, 400,000 lb, 750,000 lb, 1,500,000 lb, 3,000,000 lb
-- Grip of Steel: 800 lb, 8,000 lb, 30,000 lb, 100,000 lb, 250,000 lb, 500,000 lb, 1,000,000 lb, 2,000,000 lb
-- Quad Squad: 4,000 lb, 40,000 lb, 150,000 lb, 500,000 lb, 1,250,000 lb, 2,500,000 lb, 5,000,000 lb, 10,000,000 lb
-- Hamstring Hustle: 2,500 lb, 25,000 lb, 100,000 lb, 300,000 lb, 800,000 lb, 1,500,000 lb, 3,000,000 lb, 6,000,000 lb
-- Inner Strength: 2,500 lb, 25,000 lb, 100,000 lb, 250,000 lb, 750,000 lb, 1,250,000 lb, 2,500,000 lb, 5,000,000 lb
-- Glute Force: 4,000 lb, 40,000 lb, 150,000 lb, 500,000 lb, 1,250,000 lb, 2,500,000 lb, 5,000,000 lb, 10,000,000 lb
-- Calf Crusher: 2,500 lb, 25,000 lb, 100,000 lb, 300,000 lb, 750,000 lb, 1,500,000 lb, 3,000,000 lb, 6,000,000 lb
-- ---------------------------------------------------------------------------
insert into public.achievement_definitions
  (id, category, kind, title, description, icon, metric, unit, goal_label, visibility, sort)
values
  ('first-steps', 'workouts', 'single', 'First Steps', 'Finish your first workout', 'play', 'workouts', 'count', 'workouts', 'public', 10),
  ('first-pr', 'strength', 'single', 'First PR', 'Set your first personal record', 'award', 'prs', 'count', 'PRs held', 'public', 20),
  ('split-creator', 'exploration', 'single', 'Split Creator', 'Make your first workout split', 'columns', 'splits', 'count', 'splits', 'public', 30),
  ('full-body-athlete', 'exploration', 'single', 'Full Body Athlete', 'Train every major muscle group', 'user', 'major_muscle_groups', 'count', 'muscle groups', 'public', 40),
  ('all-round-athlete', 'exploration', 'single', 'All-Round Athlete', 'Train 5 ways: weighted, bodyweight, timed, single-side, in a group or with a trainer', 'shuffle', 'training_styles', 'count', 'ways of training', 'public', 50),
  ('first-bite', 'nutrition', 'single', 'First Bite', 'Log your first food', 'coffee', 'food_entries', 'count', 'foods logged', 'private', 60),
  ('meal-prepper', 'nutrition', 'single', 'Meal Prepper', 'Save your first meal', 'package', 'saved_meals', 'count', 'saved meals', 'private', 70),
  ('first-connection', 'social', 'single', 'First Connection', 'Make your first friend -- you follow each other', 'user-plus', 'friends', 'count', 'friends', 'public', 80),
  ('iron-regular', 'workouts', 'levels', 'Iron Regular', 'Finish workouts', 'activity', 'workouts', 'count', 'workouts', 'public', 90),
  ('record-breaker', 'strength', 'levels', 'Record Breaker', 'Hold personal records', 'trending-up', 'prs', 'count', 'PRs held', 'public', 100),
  ('tonnage', 'volume', 'levels', 'Tonnage', 'Lift weight in all', 'layers', 'volume_kg', 'kg', 'lifted', 'public', 110),
  ('explorer', 'exploration', 'levels', 'Explorer', 'Do different exercises', 'compass', 'exercises', 'count', 'different exercises', 'public', 120),
  ('steady-grind', 'consistency', 'levels', 'Steady Grind', 'Train in different weeks -- never in a row, every week counts', 'calendar', 'weeks_trained', 'count', 'weeks trained', 'public', 130),
  ('level-up', 'progression', 'levels', 'Level Up', 'Lift more on one exercise, for the same reps', 'arrow-up-right', 'best_gain_pct', 'percent', 'more on one exercise', 'public', 140),
  ('across-the-board', 'progression', 'levels', 'Across the Board', 'Lift 10% more, for the same reps, on different exercises', 'bar-chart-2', 'exercises_gained_10', 'count', 'exercises up 10%', 'public', 150),
  ('fuel-logger', 'nutrition', 'levels', 'Fuel Logger', 'Log food on different days', 'book-open', 'food_days', 'count', 'days with food logged', 'private', 160),
  ('food-explorer', 'nutrition', 'levels', 'Food Explorer', 'Log different foods', 'shopping-bag', 'unique_foods', 'count', 'different foods', 'private', 170),
  ('squad-up', 'social', 'levels', 'Squad Up', 'Make friends -- people you follow who follow you back', 'users', 'friends', 'count', 'friends', 'public', 180),
  ('cheerleader', 'social', 'levels', 'Cheerleader', 'Like your friends'' workouts', 'heart', 'likes_given', 'count', 'likes given', 'public', 190),
  ('hype-magnet', 'social', 'levels', 'Hype Magnet', 'Get likes on your workouts', 'thumbs-up', 'likes_received', 'count', 'likes received', 'public', 200),
  ('pecs-appeal', 'muscles', 'levels', 'Pecs Appeal', 'Lift weight on chest exercises', 'shield', 'muscle_volume_kg_chest', 'kg', 'lifted on chest', 'public', 210),
  ('back-attack', 'muscles', 'levels', 'Back Attack', 'Lift weight on back exercises', 'chevrons-up', 'muscle_volume_kg_back', 'kg', 'lifted on back', 'public', 220),
  ('boulder-shoulders', 'muscles', 'levels', 'Boulder Shoulders', 'Lift weight on shoulders exercises', 'triangle', 'muscle_volume_kg_shoulders', 'kg', 'lifted on shoulders', 'public', 230),
  ('guns-blazin', 'muscles', 'levels', 'Guns Blazin''', 'Lift weight on biceps exercises', 'zap', 'muscle_volume_kg_biceps', 'kg', 'lifted on biceps', 'public', 240),
  ('tri-hard', 'muscles', 'levels', 'Tri Hard', 'Lift weight on triceps exercises', 'battery-charging', 'muscle_volume_kg_triceps', 'kg', 'lifted on triceps', 'public', 250),
  ('grip-of-steel', 'muscles', 'levels', 'Grip of Steel', 'Lift weight on forearms exercises', 'tool', 'muscle_volume_kg_forearms', 'kg', 'lifted on forearms', 'public', 260),
  ('quad-squad', 'muscles', 'levels', 'Quad Squad', 'Lift weight on quads exercises', 'navigation', 'muscle_volume_kg_quadriceps', 'kg', 'lifted on quads', 'public', 270),
  ('hamstring-hustle', 'muscles', 'levels', 'Hamstring Hustle', 'Lift weight on hamstrings exercises', 'git-commit', 'muscle_volume_kg_hamstrings', 'kg', 'lifted on hamstrings', 'public', 280),
  ('inner-strength', 'muscles', 'levels', 'Inner Strength', 'Lift weight on adductors exercises', 'minimize-2', 'muscle_volume_kg_adductors', 'kg', 'lifted on adductors', 'public', 290),
  ('glute-force', 'muscles', 'levels', 'Glute Force', 'Lift weight on glutes exercises', 'circle', 'muscle_volume_kg_glutes', 'kg', 'lifted on glutes', 'public', 300),
  ('calf-crusher', 'muscles', 'levels', 'Calf Crusher', 'Lift weight on calves exercises', 'chevrons-down', 'muscle_volume_kg_calves', 'kg', 'lifted on calves', 'public', 310),
  ('iron-core', 'muscles', 'levels', 'Iron Core', 'Finish core sets -- weighted, bodyweight or timed', 'target', 'core_sets', 'count', 'core sets', 'public', 320);

insert into public.achievement_levels (achievement_id, level, goal, ap)
values
  ('first-steps', 1, 1, 25),
  ('first-pr', 1, 1, 50),
  ('split-creator', 1, 1, 50),
  ('full-body-athlete', 1, 10, 200),
  ('all-round-athlete', 1, 5, 300),
  ('first-bite', 1, 1, 25),
  ('meal-prepper', 1, 1, 50),
  ('first-connection', 1, 1, 25),
  ('iron-regular', 1, 5, 50),
  ('iron-regular', 2, 10, 75),
  ('iron-regular', 3, 25, 125),
  ('iron-regular', 4, 50, 200),
  ('iron-regular', 5, 100, 350),
  ('iron-regular', 6, 250, 600),
  ('iron-regular', 7, 500, 1000),
  ('iron-regular', 8, 1000, 1750),
  ('record-breaker', 1, 5, 50),
  ('record-breaker', 2, 10, 100),
  ('record-breaker', 3, 25, 175),
  ('record-breaker', 4, 50, 300),
  ('record-breaker', 5, 100, 500),
  ('record-breaker', 6, 250, 800),
  ('record-breaker', 7, 500, 1200),
  ('tonnage', 1, 453.5924, 10),
  ('tonnage', 2, 4535.9237, 25),
  ('tonnage', 3, 22679.6185, 50),
  ('tonnage', 4, 45359.237, 75),
  ('tonnage', 5, 113398.0925, 125),
  ('tonnage', 6, 226796.185, 200),
  ('tonnage', 7, 453592.37, 300),
  ('tonnage', 8, 1133980.925, 450),
  ('tonnage', 9, 2267961.85, 650),
  ('tonnage', 10, 4535923.7, 900),
  ('tonnage', 11, 11339809.25, 1250),
  ('explorer', 1, 10, 50),
  ('explorer', 2, 25, 125),
  ('explorer', 3, 50, 250),
  ('explorer', 4, 100, 500),
  ('steady-grind', 1, 4, 25),
  ('steady-grind', 2, 12, 75),
  ('steady-grind', 3, 26, 150),
  ('steady-grind', 4, 52, 300),
  ('steady-grind', 5, 104, 500),
  ('steady-grind', 6, 156, 750),
  ('steady-grind', 7, 208, 1000),
  ('steady-grind', 8, 260, 1300),
  ('level-up', 1, 5, 50),
  ('level-up', 2, 10, 100),
  ('level-up', 3, 20, 200),
  ('level-up', 4, 35, 300),
  ('level-up', 5, 50, 450),
  ('level-up', 6, 75, 650),
  ('level-up', 7, 100, 900),
  ('across-the-board', 1, 3, 100),
  ('across-the-board', 2, 5, 200),
  ('across-the-board', 3, 10, 400),
  ('across-the-board', 4, 20, 700),
  ('across-the-board', 5, 35, 1000),
  ('fuel-logger', 1, 7, 50),
  ('fuel-logger', 2, 30, 125),
  ('fuel-logger', 3, 100, 300),
  ('fuel-logger', 4, 365, 600),
  ('fuel-logger', 5, 730, 900),
  ('fuel-logger', 6, 1095, 1250),
  ('food-explorer', 1, 50, 100),
  ('food-explorer', 2, 250, 300),
  ('food-explorer', 3, 500, 500),
  ('squad-up', 1, 5, 50),
  ('squad-up', 2, 10, 100),
  ('squad-up', 3, 25, 200),
  ('squad-up', 4, 50, 350),
  ('cheerleader', 1, 10, 25),
  ('cheerleader', 2, 50, 75),
  ('cheerleader', 3, 250, 150),
  ('cheerleader', 4, 1000, 300),
  ('hype-magnet', 1, 25, 50),
  ('hype-magnet', 2, 100, 150),
  ('hype-magnet', 3, 500, 300),
  ('hype-magnet', 4, 2000, 500),
  ('pecs-appeal', 1, 1133.9809, 20),
  ('pecs-appeal', 2, 11339.8093, 40),
  ('pecs-appeal', 3, 45359.237, 75),
  ('pecs-appeal', 4, 136077.711, 125),
  ('pecs-appeal', 5, 340194.2775, 200),
  ('pecs-appeal', 6, 680388.555, 300),
  ('pecs-appeal', 7, 1360777.11, 450),
  ('pecs-appeal', 8, 2721554.22, 650),
  ('back-attack', 1, 1360.7771, 20),
  ('back-attack', 2, 13607.7711, 40),
  ('back-attack', 3, 56699.0462, 75),
  ('back-attack', 4, 136077.711, 125),
  ('back-attack', 5, 362873.896, 200),
  ('back-attack', 6, 680388.555, 300),
  ('back-attack', 7, 1360777.11, 450),
  ('back-attack', 8, 3401942.775, 650),
  ('boulder-shoulders', 1, 680.3886, 20),
  ('boulder-shoulders', 2, 6803.8855, 40),
  ('boulder-shoulders', 3, 27215.5422, 75),
  ('boulder-shoulders', 4, 90718.474, 125),
  ('boulder-shoulders', 5, 226796.185, 200),
  ('boulder-shoulders', 6, 453592.37, 300),
  ('boulder-shoulders', 7, 907184.74, 450),
  ('boulder-shoulders', 8, 1814369.48, 650),
  ('guns-blazin', 1, 453.5924, 20),
  ('guns-blazin', 2, 4535.9237, 40),
  ('guns-blazin', 3, 18143.6948, 75),
  ('guns-blazin', 4, 56699.0462, 125),
  ('guns-blazin', 5, 136077.711, 200),
  ('guns-blazin', 6, 272155.422, 300),
  ('guns-blazin', 7, 566990.4625, 450),
  ('guns-blazin', 8, 1133980.925, 650),
  ('tri-hard', 1, 566.9905, 20),
  ('tri-hard', 2, 5669.9046, 40),
  ('tri-hard', 3, 22679.6185, 75),
  ('tri-hard', 4, 68038.8555, 125),
  ('tri-hard', 5, 181436.948, 200),
  ('tri-hard', 6, 340194.2775, 300),
  ('tri-hard', 7, 680388.555, 450),
  ('tri-hard', 8, 1360777.11, 650),
  ('grip-of-steel', 1, 362.8739, 20),
  ('grip-of-steel', 2, 3628.739, 40),
  ('grip-of-steel', 3, 13607.7711, 75),
  ('grip-of-steel', 4, 45359.237, 125),
  ('grip-of-steel', 5, 113398.0925, 200),
  ('grip-of-steel', 6, 226796.185, 300),
  ('grip-of-steel', 7, 453592.37, 450),
  ('grip-of-steel', 8, 907184.74, 650),
  ('quad-squad', 1, 1814.3695, 20),
  ('quad-squad', 2, 18143.6948, 40),
  ('quad-squad', 3, 68038.8555, 75),
  ('quad-squad', 4, 226796.185, 125),
  ('quad-squad', 5, 566990.4625, 200),
  ('quad-squad', 6, 1133980.925, 300),
  ('quad-squad', 7, 2267961.85, 450),
  ('quad-squad', 8, 4535923.7, 650),
  ('hamstring-hustle', 1, 1133.9809, 20),
  ('hamstring-hustle', 2, 11339.8093, 40),
  ('hamstring-hustle', 3, 45359.237, 75),
  ('hamstring-hustle', 4, 136077.711, 125),
  ('hamstring-hustle', 5, 362873.896, 200),
  ('hamstring-hustle', 6, 680388.555, 300),
  ('hamstring-hustle', 7, 1360777.11, 450),
  ('hamstring-hustle', 8, 2721554.22, 650),
  ('inner-strength', 1, 1133.9809, 20),
  ('inner-strength', 2, 11339.8093, 40),
  ('inner-strength', 3, 45359.237, 75),
  ('inner-strength', 4, 113398.0925, 125),
  ('inner-strength', 5, 340194.2775, 200),
  ('inner-strength', 6, 566990.4625, 300),
  ('inner-strength', 7, 1133980.925, 450),
  ('inner-strength', 8, 2267961.85, 650),
  ('glute-force', 1, 1814.3695, 20),
  ('glute-force', 2, 18143.6948, 40),
  ('glute-force', 3, 68038.8555, 75),
  ('glute-force', 4, 226796.185, 125),
  ('glute-force', 5, 566990.4625, 200),
  ('glute-force', 6, 1133980.925, 300),
  ('glute-force', 7, 2267961.85, 450),
  ('glute-force', 8, 4535923.7, 650),
  ('calf-crusher', 1, 1133.9809, 20),
  ('calf-crusher', 2, 11339.8093, 40),
  ('calf-crusher', 3, 45359.237, 75),
  ('calf-crusher', 4, 136077.711, 125),
  ('calf-crusher', 5, 340194.2775, 200),
  ('calf-crusher', 6, 680388.555, 300),
  ('calf-crusher', 7, 1360777.11, 450),
  ('calf-crusher', 8, 2721554.22, 650),
  ('iron-core', 1, 25, 20),
  ('iron-core', 2, 100, 40),
  ('iron-core', 3, 250, 75),
  ('iron-core', 4, 500, 125),
  ('iron-core', 5, 1000, 200),
  ('iron-core', 6, 2000, 300),
  ('iron-core', 7, 3500, 450),
  ('iron-core', 8, 5000, 650);

-- 32 achievements, 175 levels, 50805 AP in all

-- The awards made so far, carried over unchanged: each a single-unlock achievement with the
-- same AP. Anything else stops the migration, so no AP is ever lost or changed.
do $$
begin
  if exists (
    select 1
    from pg_temp.achievement_awards_carried c
    where c.period_key <> 'once'
      or not exists (
        select 1
        from public.achievement_levels l
        join public.achievement_definitions d on d.id = l.achievement_id
        where l.achievement_id = c.achievement_id
          and l.level = 1
          and l.ap = c.ap
          and d.kind = 'single'
      )
  ) then
    raise exception 'An award made so far has no unchanged equivalent in the new catalogue';
  end if;
end;
$$;

insert into public.achievement_awards (user_id, achievement_id, level, ap, awarded_at)
select user_id, achievement_id, 1, ap, awarded_at from pg_temp.achievement_awards_carried;

-- ---------------------------------------------------------------------------
-- Every figure the catalogue is measured on, for one person, as of now in their own time zone.
-- Records held, exercises and volume come from person_profile_totals (their own view: a
-- trainer's logging counts) -- the same figures their profile shows.
-- ---------------------------------------------------------------------------
create function public.achievement_metrics(p_user uuid, p_zone text)
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

revoke all on function public.achievement_metrics(uuid, text) from public, anon, authenticated;
grant execute on function public.achievement_metrics(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Awarding: every level reached and not yet awarded, at most once each, and where each
-- achievement now stands. One person at a time; safe to run again and again.
-- ---------------------------------------------------------------------------
create function public.award_achievements(p_user uuid, p_zone text)
returns table (achievement_id text, level smallint, ap integer, awarded_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_zone text := public.achievement_zone(p_zone);
  v_metrics jsonb;
begin
  -- Two runs for the same person at once take turns; the unique key does the rest.
  perform pg_advisory_xact_lock(hashtextextended('achievements:' || p_user::text, 0));

  v_metrics := public.achievement_metrics(p_user, v_zone);

  -- What this run newly awards is what it returns.
  return query
  with inserted as (
    insert into public.achievement_awards (user_id, achievement_id, level, ap)
    select p_user, l.achievement_id, l.level, l.ap
    from public.achievement_levels l
    join public.achievement_definitions d on d.id = l.achievement_id
    where coalesce((v_metrics ->> d.metric)::numeric, 0) >= l.goal
    on conflict on constraint achievement_awards_user_id_achievement_id_level_key do nothing
    returning achievement_awards.achievement_id, achievement_awards.level,
      achievement_awards.ap, achievement_awards.awarded_at
  )
  select i.achievement_id, i.level, i.ap, i.awarded_at from inserted i;

  -- Then where each stands (a later statement, so it sees those awards): the figure now, and
  -- the level reached -- never below one awarded.
  insert into public.achievement_progress (user_id, achievement_id, value, level, updated_at)
  select p_user, d.id, coalesce((v_metrics ->> d.metric)::numeric, 0),
    coalesce((
      select max(a.level) from public.achievement_awards a
      where a.user_id = p_user and a.achievement_id = d.id
    ), 0),
    now()
  from public.achievement_definitions d
  on conflict on constraint achievement_progress_pkey do update
    set value = excluded.value, level = excluded.level, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.award_achievements(uuid, text) from public, anon, authenticated;
grant execute on function public.award_achievements(uuid, text) to service_role;

/**
 * The signed-in person's own awards, with the phone's time zone (kept on their row, so their
 * weeks and days stay theirs). Returns what this run newly awarded.
 */
create function public.award_my_achievements(p_time_zone text)
returns table (achievement_id text, level smallint, ap integer, awarded_at timestamptz)
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

/**
 * For support: every level awarded to a person, whether its goal is still reached today, and
 * the running AP total in the order they were awarded. Recalculating is running
 * award_achievements again -- it only ever adds what's missing.
 */
create function public.audit_achievements(p_user uuid)
returns table (
  achievement_id text,
  level smallint,
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
#variable_conflict use_column
declare
  v_metrics jsonb := public.achievement_metrics(
    p_user,
    (select u.time_zone from public.users u where u.id = p_user)
  );
begin
  return query
  select a.achievement_id, a.level, a.ap, a.awarded_at,
    coalesce((v_metrics ->> d.metric)::numeric, 0) >= l.goal,
    (sum(a.ap) over (order by a.awarded_at, a.achievement_id, a.level))::integer
  from public.achievement_awards a
  join public.achievement_levels l on l.achievement_id = a.achievement_id and l.level = a.level
  join public.achievement_definitions d on d.id = a.achievement_id
  where a.user_id = p_user
  order by a.awarded_at, a.achievement_id, a.level;
end;
$$;

revoke all on function public.audit_achievements(uuid) from public, anon, authenticated;
grant execute on function public.audit_achievements(uuid) to service_role;
