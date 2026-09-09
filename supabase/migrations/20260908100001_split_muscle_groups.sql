-- Split days need a finer-grained muscle-group vocabulary than exercises do
-- (front/side/rear delts, lats vs. upper back vs. traps, abs vs. obliques,
-- etc.) that doesn't correspond 1:1 to exercises.muscle_group's coarser
-- classification. Deliberately a separate enum rather than expanding the
-- shared one: exercise filtering/recommendation by muscle group is
-- explicitly out of scope for now, so there is no need (or safe way,
-- without reclassifying every existing built-in exercise) to unify the two
-- vocabularies yet.
--
-- workout_split_day_muscle_groups is pre-launch (no real user data), so it's
-- safe to clear before adopting the new vocabulary below.
delete from public.workout_split_day_muscle_groups;

create type public.split_muscle_group as enum (
  'chest',
  'upper_chest',
  'lats',
  'upper_back',
  'traps',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'calves'
);

alter table public.workout_split_day_muscle_groups
  alter column muscle_group type public.split_muscle_group
  using muscle_group::text::public.split_muscle_group;
