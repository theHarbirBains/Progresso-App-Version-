-- Equipment profiles: an optional, exercise-scoped record of a specific
-- machine/equipment setup a user trains on (a name, plus an optional gym
-- and photo). Purely descriptive/contextual for now: nothing in `sets` or
-- `workout_exercises` references an equipment profile yet, so creating one
-- has no effect on Top Set/PR computation or progression history. The
-- product rule that meaningfully different equipment should eventually get
-- its own progression history (while merely a different gym or a photo
-- should not) is a deliberately separate, not-yet-built follow-up -- see
-- CLAUDE.md's rule against silently changing PR-correctness-critical logic.
-- This table exists today only so a user can record/identify which
-- specific machine they used.
create table public.equipment_profiles (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null,
  gym text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.equipment_profiles
for each row execute function public.set_updated_at();

create index equipment_profiles_exercise_idx on public.equipment_profiles (exercise_id);
create index equipment_profiles_created_by_idx on public.equipment_profiles (created_by);

alter table public.equipment_profiles enable row level security;

-- User data isolation: a user only ever sees/writes their own equipment
-- profiles, regardless of whether the underlying exercise is a built-in or
-- one of their own customs.
create policy "equipment_profiles_select_own"
on public.equipment_profiles for select
to authenticated
using (created_by = auth.uid());

create policy "equipment_profiles_insert_own"
on public.equipment_profiles for insert
to authenticated
with check (created_by = auth.uid());

create policy "equipment_profiles_update_own"
on public.equipment_profiles for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "equipment_profiles_delete_own"
on public.equipment_profiles for delete
to authenticated
using (created_by = auth.uid());

-- Storage bucket for machine/equipment photos -- same "public read, per-user
-- folder write" pattern as the avatars bucket (see profile_picture
-- migration): what needs isolating is WRITE access, enforced by the
-- "{auth.uid()}/..." path convention below.
insert into storage.buckets (id, name, public)
values ('equipment-photos', 'equipment-photos', true)
on conflict (id) do nothing;

create policy "equipment_photo_insert_own"
on storage.objects for insert
to authenticated
with check (bucket_id = 'equipment-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "equipment_photo_update_own"
on storage.objects for update
to authenticated
using (bucket_id = 'equipment-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'equipment-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "equipment_photo_delete_own"
on storage.objects for delete
to authenticated
using (bucket_id = 'equipment-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "equipment_photo_select_public"
on storage.objects for select
to public
using (bucket_id = 'equipment-photos');
