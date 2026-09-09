-- Splits the general "legs" category back into 4 specific categories
-- (approved product decision): Quads, Hamstrings, Glutes, Calves. Every
-- other general category (Chest/Back/Shoulders/Biceps/Triceps/Forearms/Abs)
-- is untouched.
--
-- workout_split_day_muscle_groups is still pre-launch (no real user data
-- beyond this session's own testing), so it's safe to clear before adopting
-- the new vocabulary below, matching the same approach the previous two
-- split_muscle_group migrations used.
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
  'quads',
  'hamstrings',
  'glutes',
  'calves'
);

alter table public.workout_split_day_muscle_groups
  alter column muscle_group type public.split_muscle_group
  using muscle_group::text::public.split_muscle_group;

drop type public.split_muscle_group_old;
