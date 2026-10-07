-- ---------------------------------------------------------------------------
-- One live workout at a time
-- ---------------------------------------------------------------------------
-- A person has at most one open workout across solo, group and trainer-run
-- sessions, and a trainer has at most one open session running at a time.
-- Replaces workouts_one_active_per_session, which allowed one open workout
-- per session kind.
--
-- This will fail if a person already has more than one open workout. Cancel
-- or finish the extra ones first, then apply it.

drop index if exists public.workouts_one_active_per_session;

create unique index workouts_one_live_per_user
on public.workouts (user_id)
where completed_at is null and deleted_at is null;

create unique index workouts_one_live_per_trainer
on public.workouts (logged_by)
where logged_by is not null and completed_at is null and deleted_at is null;
