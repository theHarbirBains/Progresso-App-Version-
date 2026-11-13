-- The membership each person chooses: which parts of the app they use. Free for
-- now, and changeable any time in Settings.
--   workouts            -- workout tracking and everything that goes with it
--   workouts_nutrition  -- that, and nutrition
--   everything          -- that, and Trainer Mode
-- Accounts from before tiers keep everything they had.

alter table public.users
  add column membership_tier text not null default 'everything'
  check (membership_tier in ('workouts', 'workouts_nutrition', 'everything'));
