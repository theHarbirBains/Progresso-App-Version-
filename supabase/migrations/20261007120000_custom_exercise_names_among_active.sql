-- ---------------------------------------------------------------------------
-- A deleted custom exercise frees its name
-- ---------------------------------------------------------------------------
-- Deleting a custom exercise deactivates it (is_active = false) so past workouts keep
-- their history. Its name should be free again, so uniqueness applies to active custom
-- exercises only.

drop index if exists public.exercises_custom_name_unique;

create unique index exercises_custom_name_unique
on public.exercises (created_by, lower(name))
where created_by is not null and is_active;
