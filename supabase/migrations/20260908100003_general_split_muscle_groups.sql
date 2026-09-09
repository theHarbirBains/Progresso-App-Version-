-- Collapses the 17-value split_muscle_group vocabulary down to 8 general
-- categories (approved product decision: custom-split creation should never
-- offer multiple granular groups for what a user thinks of as one muscle,
-- e.g. front/side/rear delts all becoming just "Shoulders"). Biceps,
-- Triceps, and Forearms are deliberately kept as three separate categories
-- rather than merged into one "Arms" bucket, per explicit approval.
--
-- workout_split_day_muscle_groups is still pre-launch (no real user data
-- beyond this session's own testing), so it's safe to clear before adopting
-- the new vocabulary below, matching the same approach the previous
-- split_muscle_group migration used.
delete from public.workout_split_day_muscle_groups;

alter type public.split_muscle_group rename to split_muscle_group_old;

create type public.split_muscle_group as enum (
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'legs'
);

alter table public.workout_split_day_muscle_groups
  alter column muscle_group type public.split_muscle_group
  using muscle_group::text::public.split_muscle_group;

drop type public.split_muscle_group_old;
