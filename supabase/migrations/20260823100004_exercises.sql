-- Exercise library: built-in (created_by is null) or user-created custom
-- exercises. Deactivated rather than deleted so historical workout data
-- referencing them stays valid (see workout_exercises' FK below).
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete cascade,
  name text not null,
  muscle_group public.muscle_group not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

-- Unique names among built-ins, and unique per-user among a user's own
-- custom exercises. A custom exercise may share a name with a built-in.
create unique index exercises_builtin_name_unique
on public.exercises (lower(name))
where created_by is null;

create unique index exercises_custom_name_unique
on public.exercises (created_by, lower(name))
where created_by is not null;

create index exercises_created_by_idx on public.exercises (created_by);

alter table public.exercises enable row level security;

-- Everyone can see every built-in exercise (active or not, so history
-- referencing a deactivated one still renders) plus their own customs.
create policy "exercises_select"
on public.exercises for select
to authenticated
using (created_by is null or created_by = auth.uid());

-- Only custom exercises may be created by a client; built-in library
-- management is a full_admin/service-role operation (Phase 2/9).
create policy "exercises_insert_own"
on public.exercises for insert
to authenticated
with check (created_by = auth.uid());

create policy "exercises_update_own"
on public.exercises for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- No delete policy: deactivate (is_active = false) via update instead.
