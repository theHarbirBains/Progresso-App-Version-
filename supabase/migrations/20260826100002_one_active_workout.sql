-- Phase 3: at most one in-progress (not completed, not deleted) workout per
-- user. Defense-in-depth only -- the mobile app checks for an existing draft
-- before offering "start workout" and resumes it instead, so this should
-- rarely if ever actually fire; it exists to make "which draft do I resume"
-- always unambiguous rather than relying purely on app-level discipline.
create unique index workouts_one_active_per_user
on public.workouts (user_id)
where completed_at is null and deleted_at is null;
