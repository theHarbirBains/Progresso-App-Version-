-- ---------------------------------------------------------------------------
-- Rep ranges and training comfort
-- ---------------------------------------------------------------------------
-- Each person trains to one rep range across all their workouts. When an
-- exercise's top set (its heaviest completed set) reaches the top of the
-- range, the app suggests going heavier next time; until then, it suggests
-- staying at that weight and working toward the top. Bodyweight and timed
-- exercises get ways to make them harder instead (more reps, a new time, the
-- weighted version). The suggestions are worked out in the app from sets
-- already logged: nothing here stores or changes a set or a record.
--
-- training_comfort replaces the two onboarding questions nobody used
-- (training_experience, training_style_preference, kept for older app
-- builds). Onboarding sets the starting range from it: 8-12 for the first two
-- answers, 5-10 for the other two. The range can be changed any time.

alter table public.users
  add column training_comfort text,
  add column rep_range_min smallint not null default 8,
  add column rep_range_max smallint not null default 12,
  add column progression_cues_enabled boolean not null default true;

alter table public.users
  add constraint users_training_comfort_check check (
    training_comfort is null
    or training_comfort in ('still_learning', 'knows_basics', 'plans_and_progresses', 'follows_method')
  ),
  add constraint users_rep_range_check check (
    rep_range_min >= 1 and rep_range_max <= 50 and rep_range_min < rep_range_max
  );

-- Accounts made before this never saw the new question: their range starts
-- from the old experience answer.
update public.users
set rep_range_min = 5, rep_range_max = 10
where training_experience in ('intermediate', 'advanced');
