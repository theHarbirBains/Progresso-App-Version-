-- Onboarding/sign-up redesign: profile fields collected during the
-- multi-step onboarding flow. All nullable -- a null value simply means
-- "not answered yet" (including a deliberately skipped optional step, e.g.
-- Apple Health "Not Now"), so existing rows and partially-completed
-- onboarding both stay valid with no backfill required.
--
-- weight_value/height_value are canonical (kg / cm respectively), matching
-- the existing weight_unit column's "canonical unit + display preference"
-- split. height_unit is a display preference only (cm vs ft/in), same
-- pattern as weight_unit.
--
-- onboarding_completed_at follows the same "timestamptz, null = hasn't
-- happened yet" convention already used by workouts.completed_at and
-- sets.completed_at. It replaces the app's previous in-memory-only
-- justCreatedAccount flag as the persisted source of truth for whether a
-- signed-in user still needs to complete onboarding, which is what makes
-- onboarding resumable across app restarts.
alter table public.users
  add column gender text,
  add column birthday date,
  add column weight_value numeric,
  add column height_value numeric,
  add column height_unit text not null default 'cm',
  add column fitness_goal text,
  add column training_experience text,
  add column workout_frequency_days smallint,
  add column training_style_preference text,
  add column email_opt_in boolean,
  add column push_notifications_opt_in boolean,
  add column apple_health_preference text,
  add column onboarding_completed_at timestamptz;

alter table public.users add constraint users_gender_check
  check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));

alter table public.users add constraint users_birthday_check
  check (birthday is null or birthday <= current_date);

alter table public.users add constraint users_weight_value_check
  check (weight_value is null or weight_value > 0);

alter table public.users add constraint users_height_value_check
  check (height_value is null or height_value > 0);

alter table public.users add constraint users_height_unit_check
  check (height_unit in ('cm', 'ft_in'));

alter table public.users add constraint users_fitness_goal_check
  check (fitness_goal is null or fitness_goal in (
    'build_muscle', 'get_stronger', 'lose_fat', 'improve_fitness',
    'improve_athletic_performance', 'maintain_fitness', 'general_health', 'other'
  ));

alter table public.users add constraint users_training_experience_check
  check (training_experience is null or training_experience in ('beginner', 'intermediate', 'advanced'));

alter table public.users add constraint users_workout_frequency_days_check
  check (workout_frequency_days is null or workout_frequency_days between 1 and 7);

alter table public.users add constraint users_training_style_preference_check
  check (training_style_preference is null or training_style_preference in ('guided', 'build_your_own'));

alter table public.users add constraint users_apple_health_preference_check
  check (apple_health_preference is null or apple_health_preference in ('connected', 'not_now'));
