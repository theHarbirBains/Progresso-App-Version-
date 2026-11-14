-- Two machines may share a name.
--
-- Two machines that do the same thing can be told apart by their photo, gym
-- and grip (a different grip or handle works the muscles differently and
-- changes what can be lifted), so a person can have both as "Lat Pulldown" at
-- the same gym. Names are no longer unique per person per gym.
--
-- Everything that matched one person's custom exercise to another's by name
-- and gym -- a trainer logging for a client, a trainer's live session,
-- deleting an account and claiming tracked history -- now matches on the
-- machine: its name, gym, grip and photo (exercise_machine_key). A copy
-- carries its source's photo, so it still finds its own copy; two machines
-- that differ in any of those are never merged.

drop index if exists public.exercises_custom_name_unique;

create index if not exists exercises_custom_name_lookup
on public.exercises (created_by, lower(name))
where created_by is not null;

-- What makes a custom exercise one machine: its name, gym and grip (case and
-- surrounding spaces aside) and its photo.
create or replace function public.exercise_machine_key(
  p_name text,
  p_gym text,
  p_attachment text,
  p_photo_url text
)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(btrim(p_name)) || chr(31) || lower(btrim(coalesce(p_gym, ''))) || chr(31)
    || lower(btrim(coalesce(p_attachment, ''))) || chr(31) || coalesce(p_photo_url, '');
$$;

create or replace function public.trainer_log_workout(
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
        and public.exercise_machine_key(e.name, e.gym, e.attachment, e.photo_url) = public.exercise_machine_key(v_exercise.name, v_exercise.gym, v_exercise.attachment, v_exercise.photo_url)
      order by e.is_active desc, e.created_at
      limit 1;

      if v_exercise_id is null then
        insert into public.exercises (
          created_by, name, muscle_group, movement_type, logging_style, photo_url, measurement_type,
          gym, feel_notes, attachment
        )
        values (
          p_client_id,
          v_exercise.name,
          v_exercise.muscle_group,
          v_exercise.movement_type,
          v_exercise.logging_style,
          v_exercise.photo_url,
          v_exercise.measurement_type,
          v_exercise.gym,
          v_exercise.feel_notes,
          v_exercise.attachment
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
        workout_exercise_id, set_index, side, weight_kg, reps, duration_seconds, completed_at, logged_by
      )
      values (
        v_workout_exercise_id,
        (v_set->>'setIndex')::integer,
        coalesce(v_set->>'side', 'none')::public.set_side,
        (v_set->>'weightKg')::numeric,
        (v_set->>'reps')::integer,
        (v_set->>'durationSeconds')::integer,
        v_performed_at,
        p_trainer_id
      );
    end loop;
  end loop;

  return v_workout_id;
end;
$$;

create or replace function public.resolve_client_exercise(p_trainer uuid, p_client uuid, p_exercise uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ex public.exercises%rowtype;
  v_id uuid;
begin
  if not exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_id = p_trainer and tc.client_id = p_client and tc.status = 'active'
  ) then
    raise exception 'not an active client of this trainer' using errcode = '42501';
  end if;

  if not public.has_trainer_entitlement(p_trainer) then
    raise exception 'trainer entitlement is not active' using errcode = '42501';
  end if;

  select * into v_ex from public.exercises where id = p_exercise;
  if not found or not v_ex.is_active then
    raise exception 'exercise % is not available', p_exercise using errcode = 'P0002';
  end if;

  if v_ex.created_by is null or v_ex.created_by = p_client then
    return v_ex.id;
  end if;

  if v_ex.created_by <> p_trainer then
    raise exception 'exercise % is not in this trainer''s library', p_exercise using errcode = '42501';
  end if;

  select e.id into v_id
  from public.exercises e
  where e.created_by = p_client
    and public.exercise_machine_key(e.name, e.gym, e.attachment, e.photo_url) = public.exercise_machine_key(v_ex.name, v_ex.gym, v_ex.attachment, v_ex.photo_url)
  order by e.is_active desc, e.created_at
  limit 1;
  if found then
    return v_id;
  end if;

  insert into public.exercises (
    created_by, name, muscle_group, movement_type, logging_style, photo_url, measurement_type,
    gym, feel_notes, attachment
  )
  values (
    p_client, v_ex.name, v_ex.muscle_group, v_ex.movement_type, v_ex.logging_style, v_ex.photo_url,
    v_ex.measurement_type, v_ex.gym, v_ex.feel_notes, v_ex.attachment
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_user_data(p_user uuid)
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
      e.gym,
      e.feel_notes,
      e.attachment,
      e.photo_url,
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
      and public.exercise_machine_key(x.name, x.gym, x.attachment, x.photo_url) = public.exercise_machine_key(r.name, r.gym, r.attachment, r.photo_url)
      and x.measurement_type = r.measurement_type
    limit 1;

    if v_copy is null then
      insert into public.exercises (
        created_by, name, muscle_group, movement_type, logging_style, measurement_type, is_active,
        gym, feel_notes, attachment
      )
      values (
        r.owner_id, r.name, r.muscle_group, r.movement_type, r.logging_style, r.measurement_type,
        not exists (
          select 1 from public.exercises taken
          where taken.created_by = r.owner_id and taken.is_active
            and public.exercise_machine_key(taken.name, taken.gym, taken.attachment, null)
              = public.exercise_machine_key(r.name, r.gym, r.attachment, null)
        ),
        r.gym, r.feel_notes, r.attachment
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

create or replace function public.claim_placeholder_history(p_placeholder uuid, p_client uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trainer_placeholder_clients%rowtype;
  v_moved integer;
  v_exercise_id uuid;
begin
  if p_placeholder = p_client then
    raise exception 'a placeholder cannot claim itself' using errcode = '22023';
  end if;

  select * into v_row
  from public.trainer_placeholder_clients
  where placeholder_user_id = p_placeholder and claimed_at is null;
  if not found then
    raise exception 'no unclaimed placeholder client' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.workouts w
    where w.user_id = p_placeholder and w.completed_at is null and w.deleted_at is null
  ) and exists (
    select 1 from public.workouts w
    where w.user_id = p_client and w.completed_at is null and w.deleted_at is null
  ) then
    raise exception 'finish or cancel the open workout on your account first'
      using errcode = '23505';
  end if;

  -- Which of the placeholder's custom exercises already exist on the client's
  -- account by name. Those are merged into the client's copy; the rest move.
  create temp table _exercise_map on commit drop as
  select e.id as old_id,
         coalesce(
           (select r.id from public.exercises r
            where r.created_by = p_client
              and public.exercise_machine_key(r.name, r.gym, r.attachment, r.photo_url) = public.exercise_machine_key(e.name, e.gym, e.attachment, e.photo_url)
            order by r.is_active desc, r.created_at
            limit 1),
           e.id
         ) as new_id
  from public.exercises e
  where e.created_by = p_placeholder;

  -- Rep ranges and weight steps the trainer set for an exercise move with it,
  -- onto the client's copy -- unless the client already set their own. Those
  -- for built-in exercises and for exercises merged into the client's copy move
  -- now, before the merged ones are deleted; the rest move once their exercise
  -- belongs to the client (below), as a setting must be for an exercise its
  -- owner can see.
  delete from public.exercise_progression_settings s
  where s.user_id = p_placeholder
    and exists (
      select 1 from public.exercise_progression_settings own
      where own.user_id = p_client
        and own.exercise_id = coalesce(
          (select m.new_id from _exercise_map m where m.old_id = s.exercise_id),
          s.exercise_id
        )
    );

  update public.exercise_progression_settings s
  set user_id = p_client,
      exercise_id = coalesce(
        (select m.new_id from _exercise_map m where m.old_id = s.exercise_id),
        s.exercise_id
      )
  where s.user_id = p_placeholder
    and (
      exists (select 1 from public.exercises e where e.id = s.exercise_id and e.created_by is null)
      or exists (
        select 1 from _exercise_map m where m.old_id = s.exercise_id and m.new_id <> m.old_id
      )
    );

  create temp table _moved_workouts on commit drop as
  select id from public.workouts where user_id = p_placeholder;

  -- Workouts first: the owner triggers on workout_exercises and sets derive
  -- their user_id from the parent, so they follow automatically.
  update public.workouts set user_id = p_client where user_id = p_placeholder;
  get diagnostics v_moved = row_count;

  -- Point merged exercises at the client's copy before anything refers to them.
  update public.workout_exercises we
  set exercise_id = m.new_id
  from _exercise_map m
  where we.exercise_id = m.old_id and m.new_id <> m.old_id;

  -- Machine photos for merged exercises move to the client's copy.
  update public.equipment_profiles ep
  set exercise_id = m.new_id, created_by = p_client
  from _exercise_map m
  where ep.exercise_id = m.old_id and m.new_id <> m.old_id;

  -- Rep PRs reference exercises with ON DELETE RESTRICT, so the placeholder's
  -- own PR rows go first. They are recomputed for the client below.
  delete from public.rep_prs where user_id = p_placeholder;
  delete from public.one_rep_maxes where user_id = p_placeholder;

  delete from public.exercises e
  using _exercise_map m
  where e.id = m.old_id and m.new_id <> m.old_id;

  update public.exercises set created_by = p_client where created_by = p_placeholder;

  update public.exercise_progression_settings
  set user_id = p_client
  where user_id = p_placeholder;

  update public.workout_exercises set user_id = p_client where user_id = p_placeholder;
  update public.sets set user_id = p_client where user_id = p_placeholder;

  -- Rebuild the client's PRs for every exercise in the moved history. Exercise
  -- reassignment does not fire the PR triggers, so this step is required.
  for v_exercise_id in
    select distinct we.exercise_id
    from public.workout_exercises we
    join _moved_workouts mw on mw.id = we.workout_id
  loop
    perform public.recompute_prs_for_exercise(p_client, v_exercise_id);
  end loop;

  -- Profile: fill only what the client has not set. Their own details win.
  update public.users r
  set display_name = coalesce(r.display_name, p.display_name),
      birthday = coalesce(r.birthday, p.birthday),
      height_value = coalesce(r.height_value, p.height_value),
      height_unit = case when r.height_value is null then p.height_unit else r.height_unit end,
      weight_value = coalesce(r.weight_value, p.weight_value),
      weight_unit = case when r.weight_value is null then p.weight_unit else r.weight_unit end
  from public.users p
  where r.id = p_client and p.id = p_placeholder;

  -- The trainer's link moves to the client, active: entering the trainer's own
  -- code is the client saying yes to them, so the trainer keeps seeing the
  -- history they logged. It is now linked, not managed. A link the client
  -- already had with that trainer (asked, or ended) becomes the active one.
  update public.trainer_clients existing
  set status = 'active', source = 'linked', ended_at = null
  where existing.client_id = p_client
    and exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = p_placeholder and tc.trainer_id = existing.trainer_id
    );

  delete from public.trainer_clients tc
  where tc.client_id = p_placeholder
    and exists (
      select 1 from public.trainer_clients existing
      where existing.trainer_id = tc.trainer_id and existing.client_id = p_client
    );

  update public.trainer_clients
  set client_id = p_client, status = 'active', source = 'linked', ended_at = null
  where client_id = p_placeholder;

  update public.trainer_placeholder_clients
  set claimed_by = p_client, claimed_at = now()
  where id = v_row.id;

  return v_moved;
end;
$$;

revoke all on function public.trainer_log_workout(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.trainer_log_workout(uuid, uuid, jsonb) to service_role;

revoke all on function public.resolve_client_exercise(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_client_exercise(uuid, uuid, uuid) to service_role;

revoke all on function public.claim_placeholder_history(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_placeholder_history(uuid, uuid) to service_role;

revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;
