-- Sets gain a "planned but not yet performed" state: tapping "Add Set" in
-- the live workout screen must create a real, blank row immediately (so it
-- survives navigating away or the app closing before it's filled in),
-- rather than only existing once weight/reps are already known. weight_kg
-- and reps become nullable; completed_at follows the exact same
-- nullable-timestamp convention workouts.completed_at already uses ("null =
-- hasn't happened yet"), rather than inventing a new boolean-flag pattern.
--
-- Safe for the PR-recompute trigger (recompute_prs_for_exercise in
-- 20260823100008_pr_infrastructure.sql): its queries join/filter on
-- s.reps = rp.reps and s.weight_kg, and a null never satisfies an equality
-- or > comparison in SQL, so incomplete sets are automatically excluded
-- from PR/1RM consideration without any change to that function.
alter table public.sets
  alter column weight_kg drop not null,
  alter column reps drop not null;

alter table public.sets
  drop constraint sets_weight_kg_check,
  add constraint sets_weight_kg_check check (weight_kg is null or weight_kg > 0);

alter table public.sets
  drop constraint sets_reps_check,
  add constraint sets_reps_check check (reps is null or reps > 0);

alter table public.sets
  add column completed_at timestamptz;

-- Backfill: every set that already existed before this migration necessarily
-- had valid weight/reps already (the old NOT NULL constraints guaranteed
-- it), so it was already a real, logged performance -- never leave
-- pre-existing history looking "incomplete" just because the column is new.
update public.sets set completed_at = created_at where completed_at is null;
