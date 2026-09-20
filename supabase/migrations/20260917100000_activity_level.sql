-- Adds the one piece of calorie-estimation "personal data" that doesn't
-- already exist on public.users (gender/birthday/weight_value/height_value
-- were all added by 20260908100002_onboarding_profile_fields.sql). Same
-- "nullable, checked against the app's own catalog" convention as every
-- other onboarding-style enum field on this table -- null means "not
-- answered yet", so existing rows stay valid with no backfill required.
-- See apps/mobile/src/nutrition/calorieEstimationInput.ts's ACTIVITY_LEVELS
-- for the exact 5 Mifflin-St Jeor activity-multiplier tiers this mirrors.
alter table public.users
  add column activity_level text;

alter table public.users add constraint users_activity_level_check
  check (activity_level is null or activity_level in (
    'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'
  ));
