-- Unilateral exercise support, phase 2: recording left/right performance
-- independently.
--
-- A unilateral exercise's logical set (e.g. "Set 1" of Bulgarian Split
-- Squat) is stored as TWO rows in `sets` sharing the same set_index -- one
-- with side = 'left', one with side = 'right' -- rather than a single row
-- holding a combined weight. Weight is always per side; summing left+right
-- into one number would corrupt the meaning of the exercise (40kg left +
-- 40kg right is not an 80kg set). A bilateral exercise's sets get side =
-- 'none', exactly one row per set_index, same as before this migration.
--
-- 'none' rather than a nullable column is deliberate: a plain SQL `unique`
-- constraint treats every NULL as distinct from every other NULL, so
-- unique (workout_exercise_id, set_index, side) would silently stop
-- enforcing "one row per set_index" for every bilateral set (side always
-- null) the moment side existed -- a real regression. A real, non-null
-- 'none' value keeps that original guarantee airtight while still letting
-- a unilateral exercise's left/right rows share one set_index.
create type public.set_side as enum ('none', 'left', 'right');

alter table public.sets
  add column side public.set_side not null default 'none';

-- Replaces the (workout_exercise_id, set_index) uniqueness with
-- (workout_exercise_id, set_index, side). Looked up by definition rather
-- than a hardcoded name since the original migration left the constraint
-- auto-named by Postgres.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.sets'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%(workout_exercise_id, set_index)%';

  if v_conname is not null then
    execute format('alter table public.sets drop constraint %I', v_conname);
  end if;
end $$;

alter table public.sets
  add constraint sets_workout_exercise_id_set_index_side_key
  unique (workout_exercise_id, set_index, side) deferrable initially deferred;
