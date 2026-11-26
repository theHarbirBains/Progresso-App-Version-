-- Home workout programs (explicitly requested): what equipment someone has at home, asked in
-- onboarding (skippable) and changed any time in Settings > Workout Preferences. It only decides
-- which home programs are recommended and which of a home program's exercises are marked as
-- needing something they don't have -- every home program can still be browsed.
--
-- Empty means not answered (or skipped); 'bodyweight' (No Equipment) is an answer of its own and
-- never shares the list with anything else.

alter table public.users
  add column home_equipment text[] not null default '{}'
    constraint users_home_equipment_check check (
      home_equipment <@ array[
        'bodyweight', 'dumbbells', 'adjustable_dumbbells', 'barbell', 'bench',
        'resistance_bands', 'pull_up_bar', 'cable_machine', 'home_gym', 'other'
      ]::text[]
      and cardinality(home_equipment) <= 10
      and (not ('bodyweight' = any(home_equipment)) or cardinality(home_equipment) = 1)
    );

comment on column public.users.home_equipment is
  'The equipment they have at home, for home program recommendations; empty when not answered, '
  'bodyweight alone for none.';
