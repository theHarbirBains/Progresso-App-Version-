-- The gym a workout was done at (explicitly requested): chosen by the person -- from Apple Maps'
-- gyms near them or found by name, or typed -- never assigned from where their phone is. Kept
-- against the one workout, as it was chosen: a later workout at another gym never changes an
-- earlier one's.
--
-- Its own table, readable and writable only by the workout's owner (Harbir's call: where someone
-- trains is theirs alone). Not a column on workouts, which a trainer and the people in a group
-- workout can read: none of them, nor any follower, ever sees it.

create table public.workout_gyms (
  workout_id uuid primary key references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text check (address is null or char_length(address) <= 240),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  -- Apple Maps' own id for the place, where it gives one: the same gym told apart from a
  -- look-alike name.
  place_id text check (place_id is null or char_length(place_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_gyms_coordinates_together check ((latitude is null) = (longitude is null))
);

comment on table public.workout_gyms is
  'The gym a workout was done at, as its owner chose it -- seen only by them.';

create index workout_gyms_user_recent_idx on public.workout_gyms (user_id, created_at desc);

create trigger set_updated_at
before update on public.workout_gyms
for each row execute function public.set_updated_at();

alter table public.workout_gyms enable row level security;

-- Only the workout's owner: never a trainer, a groupmate or a follower.
create policy workout_gyms_select_own on public.workout_gyms
  for select to authenticated
  using (user_id = auth.uid());

create policy workout_gyms_insert_own on public.workout_gyms
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create policy workout_gyms_update_own on public.workout_gyms
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create policy workout_gyms_delete_own on public.workout_gyms
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.workout_gyms to authenticated;
