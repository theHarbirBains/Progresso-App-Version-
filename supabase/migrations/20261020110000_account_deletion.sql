-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------
-- Deleting an account removes everything its owner logged or made, and keeps
-- everyone else's history whole:
--
-- * A friend's group workout can use another member's custom exercise (the
--   group editor shares one member's exercise with everyone). Those friends
--   get their own copy of it first, with their records rebuilt on it, the
--   way a trainer's exercise is copied to a client.
-- * A live group the person hosts finishes, as when a host finishes it, and
--   everyone else's workouts in their groups stay as their own workouts.
-- * Guests the person added to a group (placeholder accounts with no way to
--   sign in) go with them.
-- * Clients a trainer tracked without an account stay claimable for 30 days
--   after the trainer's account goes: the code the trainer gave them works for
--   that long, then their history is deleted (purge_unclaimed_tracked_clients,
--   run daily).
--
-- The API calls delete_account (service role), removes the person's photos
-- from Storage and then deletes the auth account, whose cascades remove the
-- rest: profile, foods, food logs, goals, splits, follows, blocks, push
-- tokens, subscriptions and trainer links.
--
-- Rows go in the order the foreign keys need: PR rows before the sets and
-- exercises they point at (ON DELETE RESTRICT), and nobody else's workout
-- still pointing at a group or exercise that is about to go.

-- A trainer's tracked clients outlive the trainer's account.
alter table public.trainer_placeholder_clients
  alter column trainer_id drop not null,
  add column trainer_deleted_at timestamptz;

alter table public.trainer_placeholder_clients
  drop constraint trainer_placeholder_clients_trainer_id_fkey,
  add constraint trainer_placeholder_clients_trainer_id_fkey
    foreign key (trainer_id) references auth.users (id) on delete set null;

-- Everything one account owns in the public schema, and what other people's
-- rows need moved off it first. Not callable from outside: delete_account and
-- purge_unclaimed_tracked_clients use it.
create function public.delete_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_copy uuid;
begin
  -- Other people's logged exercises that use this person's custom exercise
  -- move to a copy of their own: the same-named active exercise they already
  -- have when it measures the same thing, otherwise a new copy (inactive when
  -- that name is already taken, so it only carries their history). The copy
  -- measures what their own sessions were logged as.
  for r in
    select
      we.user_id as owner_id,
      e.id as exercise_id,
      e.name,
      e.muscle_group,
      e.movement_type,
      e.logging_style,
      (
        select latest.measurement_type
        from public.workout_exercises latest
        where latest.user_id = we.user_id and latest.exercise_id = e.id
        order by latest.created_at desc
        limit 1
      ) as measurement_type
    from public.workout_exercises we
    join public.exercises e on e.id = we.exercise_id
    where e.created_by = p_user and we.user_id <> p_user
    group by we.user_id, e.id
  loop
    select x.id into v_copy
    from public.exercises x
    where x.created_by = r.owner_id
      and x.is_active
      and lower(x.name) = lower(r.name)
      and x.measurement_type = r.measurement_type
    limit 1;

    if v_copy is null then
      insert into public.exercises (
        created_by, name, muscle_group, movement_type, logging_style, measurement_type, is_active
      )
      values (
        r.owner_id, r.name, r.muscle_group, r.movement_type, r.logging_style, r.measurement_type,
        not exists (
          select 1 from public.exercises taken
          where taken.created_by = r.owner_id and taken.is_active and lower(taken.name) = lower(r.name)
        )
      )
      returning id into v_copy;
    end if;

    update public.workout_exercises
    set exercise_id = v_copy
    where user_id = r.owner_id and exercise_id = r.exercise_id;

    update public.equipment_profiles
    set exercise_id = v_copy
    where created_by = r.owner_id and exercise_id = r.exercise_id;

    -- Moving a logged exercise doesn't fire the record triggers: clear the
    -- old exercise's records and rebuild them on the copy.
    perform public.recompute_prs_for_exercise(r.owner_id, r.exercise_id);
    perform public.recompute_records_for_exercise(r.owner_id, r.exercise_id);
    perform public.recompute_prs_for_exercise(r.owner_id, v_copy);
    perform public.recompute_records_for_exercise(r.owner_id, v_copy);
    v_copy := null;
  end loop;

  -- A live group this person hosts finishes, as when the host finishes it.
  update public.workouts w
  set completed_at = now()
  from public.workout_groups g
  where g.host_id = p_user
    and g.status = 'live'
    and w.group_id = g.id
    and w.user_id <> p_user
    and w.completed_at is null
    and w.deleted_at is null;

  -- Everyone else's workouts in their groups stay, as their own workouts.
  update public.workouts
  set group_id = null
  where user_id <> p_user
    and group_id in (select id from public.workout_groups where host_id = p_user);

  -- Records first: they point at sets and exercises that can't go while they do.
  delete from public.rep_prs where user_id = p_user;
  delete from public.one_rep_maxes where user_id = p_user;
  delete from public.rep_records where user_id = p_user;
  delete from public.duration_records where user_id = p_user;

  delete from public.sets where user_id = p_user;
  delete from public.workout_exercises where user_id = p_user;
  delete from public.workouts where user_id = p_user;

  -- Their members go with them.
  delete from public.workout_groups where host_id = p_user;

  -- Nothing anyone else has points at these any more.
  delete from public.exercises where created_by = p_user;

  -- Copies of their exercises in other people's libraries (a trainer's, copied
  -- to a client) still point at their photos, which go with the account.
  update public.exercises
  set photo_url = null
  where created_by is distinct from p_user
    and photo_url like '%/' || p_user::text || '/%';

  update public.admin_users set granted_by = null where granted_by = p_user;

  -- A trainer's tracked clients stay claimable for 30 days.
  update public.trainer_placeholder_clients
  set trainer_deleted_at = now(),
      code_expires_at = greatest(code_expires_at, now() + interval '30 days')
  where trainer_id = p_user
    and claimed_at is null;
end;
$$;

revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;

-- Deletes an account's data and that of the guests it added to groups.
-- Returns the auth accounts the API then deletes: this one first, then the
-- guests'. Called by the API (service role) only.
create function public.delete_account(p_user uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guests uuid[];
  v_guest uuid;
begin
  select coalesce(array_agg(distinct m.user_id), '{}')
  into v_guests
  from public.workout_group_members m
  where m.is_guest and m.added_by = p_user and m.user_id <> p_user;

  foreach v_guest in array v_guests loop
    perform public.delete_user_data(v_guest);
  end loop;

  perform public.delete_user_data(p_user);

  return array_prepend(p_user, v_guests);
end;
$$;

revoke all on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;

-- Tracked clients nobody claimed within 30 days of their trainer's account
-- being deleted: their history and placeholder account go. Returns how many.
create function public.purge_unclaimed_tracked_clients()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id, placeholder_user_id
    from public.trainer_placeholder_clients
    where claimed_at is null
      and trainer_id is null
      and trainer_deleted_at < now() - interval '30 days'
  loop
    perform public.delete_user_data(r.placeholder_user_id);
    delete from auth.users where id = r.placeholder_user_id;
    delete from public.trainer_placeholder_clients where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.purge_unclaimed_tracked_clients() from public, anon, authenticated;

-- Daily, where pg_cron is available (Supabase has it; the local test database
-- doesn't, and calls the function directly).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'purge-unclaimed-tracked-clients',
      '30 4 * * *',
      'select public.purge_unclaimed_tracked_clients()'
    );
  end if;
end;
$$;
