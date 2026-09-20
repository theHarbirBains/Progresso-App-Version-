-- Unilateral exercise support, phase 1: the exercise definition itself.
--
-- A unilateral movement (Bulgarian Split Squat, Single-Arm Row, ...) is
-- still ONE exercise row -- never split into "Exercise -- Left"/
-- "Exercise -- Right". What varies is how it's performed: movement_type
-- distinguishes bilateral (both sides together, or no sides at all -- the
-- vast majority of the library) from unilateral (one side at a time), and
-- logging_style (only meaningful for a unilateral exercise) distinguishes
-- single_side (e.g. Single-Arm Row: complete one side's sets, then the
-- other, as separate logical sets) from alternating (e.g. Bulgarian Split
-- Squat: each logical set has both a left and a right performance). The
-- actual left/right data lives on `sets` (see the next migration) -- this
-- migration only classifies the exercise.
create type public.movement_type as enum ('bilateral', 'unilateral');
create type public.logging_style as enum ('single_side', 'alternating');

alter table public.exercises
  add column movement_type public.movement_type not null default 'bilateral',
  add column logging_style public.logging_style;

-- logging_style is meaningful only for a unilateral exercise, and required
-- once it is one -- never set for a bilateral exercise, never left unset
-- for a unilateral one.
alter table public.exercises
  add constraint exercises_logging_style_matches_movement_type check (
    (movement_type = 'bilateral' and logging_style is null)
    or (movement_type = 'unilateral' and logging_style is not null)
  );
