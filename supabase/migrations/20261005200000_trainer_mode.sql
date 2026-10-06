-- Trainer mode, workouts only. See docs/proposals/trainer-mode/README.md.
--
-- A trainer with an active Trainer entitlement can view and log workouts for
-- clients they have an active link to. Clients are real auth users (managed
-- clients are created by the API via invite). Everything a trainer writes is
-- attributed (logged_by) and audited (trainer_actions).
--
-- Policies here are additive (permissive policies OR together), so the
-- existing owner-only policies are unchanged.

-- ---------------------------------------------------------------------------
-- Entitlement
-- ---------------------------------------------------------------------------

-- The Trainer entitlement from the RevenueCat projection. RevenueCat remains
-- authoritative; this only reads the projection the webhook writes.
create function public.has_trainer_entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.entitlement_id = 'trainer'
      and s.status = 'active'
      and s.current_period_ends_at > now()
  );
$$;

revoke all on function public.has_trainer_entitlement(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Relationship and audit tables
-- ---------------------------------------------------------------------------

create table public.trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  -- pending: an existing account was asked and has not yet accepted.
  -- active: the client accepted, or the trainer created a managed client.
  -- ended: either side ended the link. Data is kept; access stops.
  status text not null default 'pending' check (status in ('pending', 'active', 'ended')),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trainer_id <> client_id),
  unique (trainer_id, client_id)
);

create trigger set_updated_at
before update on public.trainer_clients
for each row execute function public.set_updated_at();

create index trainer_clients_client_id_idx on public.trainer_clients (client_id);

alter table public.trainer_clients enable row level security;

-- Both sides can see the link. Writes happen only through the API (service
-- role), which owns the invite, accept, decline and end rules.
create policy "trainer_clients_select_party"
on public.trainer_clients for select
to authenticated
using (trainer_id = auth.uid() or client_id = auth.uid());

revoke insert, update, delete on public.trainer_clients from anon, authenticated;

-- Append-only audit of trainer activity. No foreign keys: audit rows must
-- survive account deletion, and an ON DELETE SET NULL would be an UPDATE the
-- append-only trigger rejects.
create table public.trainer_actions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  client_id uuid,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index trainer_actions_client_idx on public.trainer_actions (client_id, created_at desc);
create index trainer_actions_trainer_idx on public.trainer_actions (trainer_id, created_at desc);

create function public.trg_trainer_actions_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'trainer_actions is append-only';
end;
$$;

create trigger trainer_actions_append_only
before update or delete on public.trainer_actions
for each row execute function public.trg_trainer_actions_append_only();

alter table public.trainer_actions enable row level security;

create policy "trainer_actions_select_party"
on public.trainer_actions for select
to authenticated
using (trainer_id = auth.uid() or client_id = auth.uid());

revoke insert, update, delete on public.trainer_actions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------

-- True when the caller is an active trainer of p_client_id and currently has
-- the Trainer entitlement. Used by every trainer policy below.
create function public.is_active_trainer_for(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trainer_clients tc
    where tc.trainer_id = auth.uid()
      and tc.client_id = p_client_id
      and tc.status = 'active'
  )
  and public.has_trainer_entitlement(auth.uid());
$$;

revoke all on function public.is_active_trainer_for(uuid) from public, anon;

-- Looks up an auth user by email for the API's add-client flow. Service role
-- only: clients must not be able to enumerate accounts by email.
create function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from auth.users u where lower(u.email) = lower(p_email) limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Attribution (logged_by)
-- ---------------------------------------------------------------------------
-- logged_by is the trainer who wrote the row, or null when the owner wrote it.
-- Client-reachable writes (role 'authenticated') can never choose it: it is
-- derived from the JWT on insert and frozen on update. Service-role writes
-- (the API) keep the value they were given, and the API always sets it.

alter table public.workouts add column logged_by uuid;
alter table public.workout_exercises add column logged_by uuid;
alter table public.sets add column logged_by uuid;

create function public.trg_workouts_logged_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.logged_by := case when auth.uid() is distinct from new.user_id then auth.uid() end;
    else
      new.logged_by := old.logged_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger workouts_logged_by
before insert or update on public.workouts
for each row execute function public.trg_workouts_logged_by();

create function public.trg_workout_exercises_logged_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      select w.user_id into v_owner from public.workouts w where w.id = new.workout_id;
      new.logged_by := case when auth.uid() is distinct from v_owner then auth.uid() end;
    else
      new.logged_by := old.logged_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger workout_exercises_logged_by
before insert or update on public.workout_exercises
for each row execute function public.trg_workout_exercises_logged_by();

create function public.trg_sets_logged_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      select w.user_id into v_owner
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = new.workout_exercise_id;
      new.logged_by := case when auth.uid() is distinct from v_owner then auth.uid() end;
    else
      new.logged_by := old.logged_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger sets_logged_by
before insert or update on public.sets
for each row execute function public.trg_sets_logged_by();

-- ---------------------------------------------------------------------------
-- Trainer policies (additive)
-- ---------------------------------------------------------------------------

create policy "workouts_trainer_select"
on public.workouts for select
to authenticated
using (public.is_active_trainer_for(user_id));

create policy "workouts_trainer_insert"
on public.workouts for insert
to authenticated
with check (public.is_active_trainer_for(user_id));

create policy "workouts_trainer_update"
on public.workouts for update
to authenticated
using (public.is_active_trainer_for(user_id))
with check (public.is_active_trainer_for(user_id));

create policy "workout_exercises_trainer_select"
on public.workout_exercises for select
to authenticated
using (public.is_active_trainer_for(user_id));

create policy "workout_exercises_trainer_insert"
on public.workout_exercises for insert
to authenticated
with check (public.is_active_trainer_for(user_id));

create policy "workout_exercises_trainer_update"
on public.workout_exercises for update
to authenticated
using (public.is_active_trainer_for(user_id))
with check (public.is_active_trainer_for(user_id));

create policy "sets_trainer_select"
on public.sets for select
to authenticated
using (public.is_active_trainer_for(user_id));

create policy "sets_trainer_insert"
on public.sets for insert
to authenticated
with check (public.is_active_trainer_for(user_id));

create policy "sets_trainer_update"
on public.sets for update
to authenticated
using (public.is_active_trainer_for(user_id))
with check (public.is_active_trainer_for(user_id));

-- Read-only views of the client's computed performance data.
create policy "rep_prs_trainer_select"
on public.rep_prs for select
to authenticated
using (public.is_active_trainer_for(user_id));

create policy "one_rep_maxes_trainer_select"
on public.one_rep_maxes for select
to authenticated
using (public.is_active_trainer_for(user_id));

-- The client's profile (name, birthday, height, weight) for the trainer.
create policy "users_trainer_select"
on public.users for select
to authenticated
using (public.is_active_trainer_for(id));

-- A client's own custom exercises are readable by their active trainer, so
-- the client's workout history shows their exercise names and photos.
create policy "exercises_trainer_select_client_customs"
on public.exercises for select
to authenticated
using (created_by is not null and public.is_active_trainer_for(created_by));

-- ---------------------------------------------------------------------------
-- Atomic workout logging for a client
-- ---------------------------------------------------------------------------
-- The API calls this with the service role, after its own checks. One call is
-- one transaction, so a workout is either saved whole or not at all, and the
-- PR/1RM trigger chain runs inside it.
--
-- Exercise rules (copy-on-log):
--   * a built-in exercise is referenced directly;
--   * the client's own custom exercise is referenced directly;
--   * the trainer's custom exercise is copied into the client's library
--     (find by name, or create), so the client owns it and keeps it;
--   * anything else is refused.
--
-- Payload:
--   { name, performedAt, completedAt?, notes?,
--     exercises: [ { exerciseId, sets: [ { setIndex, side?, weightKg, reps } ] } ] }
-- Order and set indexes are 1-based, matching the mobile app.
create function public.trainer_log_workout(
  p_trainer_id uuid,
  p_client_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_id uuid;
  v_item jsonb;
  v_set jsonb;
  v_exercise public.exercises%rowtype;
  v_exercise_id uuid;
  v_workout_exercise_id uuid;
  v_performed_at timestamptz := (p_payload->>'performedAt')::timestamptz;
  v_order integer := 0;
begin
  if not exists (
    select 1
    from public.trainer_clients tc
    where tc.trainer_id = p_trainer_id
      and tc.client_id = p_client_id
      and tc.status = 'active'
  ) then
    raise exception 'not an active client of this trainer' using errcode = '42501';
  end if;

  if not public.has_trainer_entitlement(p_trainer_id) then
    raise exception 'trainer entitlement is not active' using errcode = '42501';
  end if;

  insert into public.workouts (user_id, name, performed_at, completed_at, notes, logged_by)
  values (
    p_client_id,
    p_payload->>'name',
    v_performed_at,
    nullif(p_payload->>'completedAt', '')::timestamptz,
    nullif(p_payload->>'notes', ''),
    p_trainer_id
  )
  returning id into v_workout_id;

  for v_item in select value from jsonb_array_elements(p_payload->'exercises') loop
    v_order := v_order + 1;

    select * into v_exercise
    from public.exercises
    where id = (v_item->>'exerciseId')::uuid;

    if not found or not v_exercise.is_active then
      raise exception 'exercise % is not available', v_item->>'exerciseId'
        using errcode = 'P0002';
    end if;

    if v_exercise.created_by is null or v_exercise.created_by = p_client_id then
      v_exercise_id := v_exercise.id;
    elsif v_exercise.created_by = p_trainer_id then
      select e.id into v_exercise_id
      from public.exercises e
      where e.created_by = p_client_id
        and lower(e.name) = lower(v_exercise.name);

      if v_exercise_id is null then
        insert into public.exercises (
          created_by, name, muscle_group, movement_type, logging_style, photo_url
        )
        values (
          p_client_id,
          v_exercise.name,
          v_exercise.muscle_group,
          v_exercise.movement_type,
          v_exercise.logging_style,
          v_exercise.photo_url
        )
        returning id into v_exercise_id;
      end if;
    else
      raise exception 'exercise % is not in this trainer''s library', v_exercise.id
        using errcode = '42501';
    end if;

    insert into public.workout_exercises (workout_id, exercise_id, order_index, logged_by)
    values (v_workout_id, v_exercise_id, v_order, p_trainer_id)
    returning id into v_workout_exercise_id;

    for v_set in select value from jsonb_array_elements(coalesce(v_item->'sets', '[]'::jsonb)) loop
      insert into public.sets (
        workout_exercise_id, set_index, side, weight_kg, reps, completed_at, logged_by
      )
      values (
        v_workout_exercise_id,
        (v_set->>'setIndex')::integer,
        coalesce(v_set->>'side', 'none')::public.set_side,
        (v_set->>'weightKg')::numeric,
        (v_set->>'reps')::integer,
        v_performed_at,
        p_trainer_id
      );
    end loop;
  end loop;

  return v_workout_id;
end;
$$;

revoke all on function public.trainer_log_workout(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.trainer_log_workout(uuid, uuid, jsonb) to service_role;
