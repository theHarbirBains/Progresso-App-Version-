-- Cardio in a workout (explicitly requested): a workout can hold cardio activities alongside its
-- exercises -- before the lifting, between exercises, or after it -- or nothing but cardio. One
-- workout record either way, never a separate one for the cardio, so history, the feed and a
-- profile show them together.
--
-- Cardio is kept apart from sets: an activity is its own row here, never a workout_exercise or a
-- set, so PRs, records, top sets, progression, volume and set counts are exactly what they were.
-- Its figures are typed in (no GPS, Apple Health or other integration): the time it took
-- (required), and as the activity suits it the distance, calories, speed, incline, resistance
-- level or floors. Canonical units, as weights are kilograms: metres, km/h, percent.
--
-- Time: Finish in the live workout asks whether the person is doing cardio; if they are, the
-- strength part of the workout ends there (`workouts.strength_ended_at`), and the cardio they add
-- after it is `after_strength`. Strength training time is the workout's start to that moment (or
-- to its finish, when it never ended early) less the cardio done before it; cardio time is each
-- activity's own time; total active training is the two together. The session's own time (start
-- to finish) is told apart from it, and none of these is stored -- each is worked out from these
-- rows wherever it's shown, so editing or removing an activity puts every figure right at once.

alter table public.workouts
  add column strength_ended_at timestamptz;

comment on column public.workouts.strength_ended_at is
  'When the strength part of a workout ended, for cardio after it: strength time is the start to here, less the cardio before it.';

create table public.workout_cardio (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  -- The workout's owner, always set from the workout by trigger -- never trusted from the client.
  user_id uuid not null references auth.users (id) on delete cascade,
  activity text not null check (
    activity in (
      'treadmill', 'outdoor_run', 'walking', 'cycling', 'stairmaster', 'elliptical', 'rowing',
      'swimming', 'other'
    )
  ),
  -- What an "Other" activity was ("Jump Rope").
  name text check (name is null or char_length(btrim(name)) between 1 and 60),
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  distance_m numeric(9, 2) check (distance_m is null or (distance_m > 0 and distance_m <= 1000000)),
  calories integer check (calories is null or calories between 1 and 20000),
  speed_kmh numeric(5, 2) check (speed_kmh is null or (speed_kmh > 0 and speed_kmh <= 100)),
  incline_percent numeric(4, 1) check (incline_percent is null or incline_percent between -10 and 40),
  resistance_level smallint check (resistance_level is null or resistance_level between 1 and 50),
  floors integer check (floors is null or floors between 1 and 10000),
  -- Done once the strength part had ended (Finish's "Add Cardio"): its time isn't taken out of
  -- the strength time.
  after_strength boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workout_cardio is
  'A cardio activity in a workout: its own row, never a set -- counted toward no record, volume or set count.';

create index workout_cardio_workout_id_idx on public.workout_cardio (workout_id, created_at);
create index workout_cardio_user_id_idx on public.workout_cardio (user_id);

create trigger set_updated_at
before update on public.workout_cardio
for each row execute function public.set_updated_at();

-- The same ownership rule as sets: the row's owner is the workout's, so a spoofed user_id can
-- never attach cardio to someone else's workout, and an activity never moves between workouts.
create function public.trg_workout_cardio_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.workout_id is distinct from old.workout_id then
    raise exception 'a cardio activity stays with its workout' using errcode = '42501';
  end if;

  select w.user_id into new.user_id
  from public.workouts w
  where w.id = new.workout_id;

  if new.user_id is null then
    raise exception 'workout not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function public.trg_workout_cardio_owner() from public, anon, authenticated;

create trigger workout_cardio_owner
before insert or update on public.workout_cardio
for each row execute function public.trg_workout_cardio_owner();

-- A workout that changes hands (a tracked client's history, claimed) takes its cardio with it.
create function public.trg_workouts_cardio_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workout_cardio set user_id = new.user_id where workout_id = new.id;
  return new;
end;
$$;

revoke all on function public.trg_workouts_cardio_owner() from public, anon, authenticated;

create trigger workouts_cardio_owner
after update of user_id on public.workouts
for each row
when (new.user_id is distinct from old.user_id)
execute function public.trg_workouts_cardio_owner();

-- Own rows, straight from the app, like sets. A trainer reads an active client's (their Activity
-- and a client's workouts); followers read through the API, which is the one place a workout is
-- shown to anyone else.
alter table public.workout_cardio enable row level security;

create policy "workout_cardio_select_own"
on public.workout_cardio for select
to authenticated
using (user_id = auth.uid());

create policy "workout_cardio_insert_own"
on public.workout_cardio for insert
to authenticated
with check (user_id = auth.uid());

create policy "workout_cardio_update_own"
on public.workout_cardio for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "workout_cardio_delete_own"
on public.workout_cardio for delete
to authenticated
using (user_id = auth.uid());

create policy "workout_cardio_trainer_select"
on public.workout_cardio for select
to authenticated
using (public.is_active_trainer_for(user_id));

grant select, insert, update, delete on public.workout_cardio to authenticated;

-- achievement_valid_workouts: a finished workout of cardio alone is a workout too (Harbir's call)
-- -- toward Workouts and Weeks Trained. Cardio adds nothing to sets, volume or a muscle group.
create or replace function public.achievement_valid_workouts(p_user uuid, p_zone text)
returns table (workout_id uuid, week_start date, month_key text, group_id uuid, logged_by uuid)
language sql
stable
security definer
set search_path = public
as $$
  select w.id,
    date_trunc('week', w.performed_at at time zone p_zone)::date,
    to_char(w.performed_at at time zone p_zone, 'YYYY-MM'),
    w.group_id,
    w.logged_by
  from public.workouts w
  where w.user_id = p_user
    and w.completed_at is not null
    and w.deleted_at is null
    and (
      exists (
        select 1
        from public.workout_exercises we
        join public.sets s on s.workout_exercise_id = we.id
        where we.workout_id = w.id
          and we.deleted_at is null
          and s.deleted_at is null
          and s.completed_at is not null
          and not s.is_warmup
      )
      or exists (select 1 from public.workout_cardio c where c.workout_id = w.id)
    );
$$;
