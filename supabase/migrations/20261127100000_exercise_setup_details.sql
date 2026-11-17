-- Custom exercises: grip and attachment told apart, the equipment, the pulley's position and
-- setup notes.
--
-- 1. What a custom exercise records about its setup (Create Exercise), every one optional:
--    equipment       -- what it's done with: 'dumbbell', 'barbell', 'kettlebell', 'cable',
--                       'machine', 'bodyweight' or 'other'. It decides which setup fields the
--                       form offers.
--    grip            -- how it's held (wide, close, neutral, overhand, underhand, mixed), or on
--                       a leg machine where the feet go. Before, grip and handle shared one field.
--    attachment      -- now only what's held: the bar or handle clipped on (straight bar, EZ bar,
--                       rope, D-handle, V-handle, lat pulldown bar).
--    pulley_position -- where the cable starts on the machine: 'high', 'mid', 'low',
--                       'adjustable' or 'other' (other or unknown). Replaces the old heavier /
--                       lighter pulley, which was a feeling, not a reference point. That column
--                       stays, as it was, for the exercises that have one: it's still part of what
--                       tells them apart, so no two of them become one.
--    setup_details   -- free notes on the adjustments that reproduce the movement (seat height
--                       4, backrest 2, ...).
--
-- 2. A grip saved in the old shared field moves to grip, when it's exactly one of the grips or
--    foot positions the form offered; anything else typed there stays the attachment.
--
-- 3. What makes a custom exercise one machine (exercise_machine_key) now includes the equipment,
--    the grip and the pulley's position, beside its name, gym, attachment, photo, weight type and
--    old pulley. Setup notes are not part of it: a seat moved a notch is the same exercise.
--    Everything that matches one person's custom exercise to another's -- a trainer logging for a
--    client, a trainer's live session, deleting an account, claiming tracked history -- matches on
--    all of it, and every copy carries all of it, notes included.
--
-- Nothing logged changes: sets, records and top sets stay on the exercise they were logged
-- against, and two custom exercises never share history, whatever their setup.

alter table public.exercises
  add column equipment text
    check (equipment in ('dumbbell', 'barbell', 'kettlebell', 'cable', 'machine', 'bodyweight', 'other')),
  add column grip text check (char_length(grip) <= 60),
  add column pulley_position text
    check (pulley_position in ('high', 'mid', 'low', 'adjustable', 'other')),
  add column setup_details text check (char_length(setup_details) <= 300);

update public.exercises
set grip = btrim(attachment),
    attachment = null
where created_by is not null
  and lower(btrim(attachment)) in (
    'wide grip', 'close grip', 'neutral grip', 'overhand', 'underhand', 'mixed grip',
    'feet high', 'feet low', 'feet wide', 'feet close', 'toes out', 'toes in'
  );

create function public.exercise_machine_key(
  p_name text,
  p_gym text,
  p_grip text,
  p_attachment text,
  p_photo_url text,
  p_load_type text,
  p_pulley text,
  p_pulley_position text,
  p_equipment text
)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(btrim(p_name)) || chr(31) || lower(btrim(coalesce(p_gym, ''))) || chr(31)
    || lower(btrim(coalesce(p_grip, ''))) || chr(31)
    || lower(btrim(coalesce(p_attachment, ''))) || chr(31) || coalesce(p_photo_url, '')
    || chr(31) || coalesce(p_load_type, '') || chr(31) || coalesce(p_pulley, '')
    || chr(31) || coalesce(p_pulley_position, '') || chr(31) || coalesce(p_equipment, '');
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
        and public.exercise_machine_key(e.name, e.gym, e.grip, e.attachment, e.photo_url, e.load_type, e.pulley, e.pulley_position, e.equipment) = public.exercise_machine_key(v_exercise.name, v_exercise.gym, v_exercise.grip, v_exercise.attachment, v_exercise.photo_url, v_exercise.load_type, v_exercise.pulley, v_exercise.pulley_position, v_exercise.equipment)
      order by e.is_active desc, e.created_at
      limit 1;

      if v_exercise_id is null then
        insert into public.exercises (
          created_by, name, muscle_group, movement_type, logging_style, photo_url, measurement_type,
          gym, feel_notes, attachment, load_type, pulley, grip, pulley_position, setup_details, equipment
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
          v_exercise.attachment,
          v_exercise.load_type,
          v_exercise.pulley,
          v_exercise.grip,
          v_exercise.pulley_position,
          v_exercise.setup_details,
          v_exercise.equipment
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
    and public.exercise_machine_key(e.name, e.gym, e.grip, e.attachment, e.photo_url, e.load_type, e.pulley, e.pulley_position, e.equipment) = public.exercise_machine_key(v_ex.name, v_ex.gym, v_ex.grip, v_ex.attachment, v_ex.photo_url, v_ex.load_type, v_ex.pulley, v_ex.pulley_position, v_ex.equipment)
  order by e.is_active desc, e.created_at
  limit 1;
  if found then
    return v_id;
  end if;

  insert into public.exercises (
    created_by, name, muscle_group, movement_type, logging_style, photo_url, measurement_type,
    gym, feel_notes, attachment, load_type, pulley, grip, pulley_position, setup_details, equipment
  )
  values (
    p_client, v_ex.name, v_ex.muscle_group, v_ex.movement_type, v_ex.logging_style, v_ex.photo_url,
    v_ex.measurement_type, v_ex.gym, v_ex.feel_notes, v_ex.attachment, v_ex.load_type, v_ex.pulley,
      v_ex.grip, v_ex.pulley_position, v_ex.setup_details, v_ex.equipment
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
  -- Other people who use this person's custom exercise -- logged it, planned
  -- it in a split day, or set a rep range on it (a friend's exercise used as
  -- it is) -- move to a copy of their own: the same machine active in their
  -- library when it measures the same thing, otherwise a new copy (inactive
  -- when that name is already taken, so it only carries their history). The
  -- copy measures what their own sessions were logged as, or what the
  -- exercise does when they never logged it.
  for r in
    select
      used.user_id as owner_id,
      e.id as exercise_id,
      e.name,
      e.muscle_group,
      e.movement_type,
      e.logging_style,
      e.gym,
      e.feel_notes,
      e.attachment,
      e.load_type,
      e.pulley,
      e.grip,
      e.pulley_position,
      e.setup_details,
      e.equipment,
      e.photo_url,
      coalesce(
        (
          select latest.measurement_type
          from public.workout_exercises latest
          where latest.user_id = used.user_id and latest.exercise_id = e.id
          order by latest.created_at desc
          limit 1
        ),
        e.measurement_type
      ) as measurement_type
    from (
      select we.user_id, we.exercise_id from public.workout_exercises we
      union
      select sde.user_id, sde.exercise_id from public.workout_split_day_exercises sde
      union
      select eps.user_id, eps.exercise_id from public.exercise_progression_settings eps
    ) used
    join public.exercises e on e.id = used.exercise_id
    where e.created_by = p_user and used.user_id <> p_user
    group by used.user_id, e.id
  loop
    select x.id into v_copy
    from public.exercises x
    where x.created_by = r.owner_id
      and x.is_active
      and public.exercise_machine_key(x.name, x.gym, x.grip, x.attachment, x.photo_url, x.load_type, x.pulley, x.pulley_position, x.equipment) = public.exercise_machine_key(r.name, r.gym, r.grip, r.attachment, r.photo_url, r.load_type, r.pulley, r.pulley_position, r.equipment)
      and x.measurement_type = r.measurement_type
    limit 1;

    if v_copy is null then
      insert into public.exercises (
        created_by, name, muscle_group, movement_type, logging_style, measurement_type, is_active,
        gym, feel_notes, attachment, load_type, pulley, grip, pulley_position, setup_details, equipment
      )
      values (
        r.owner_id, r.name, r.muscle_group, r.movement_type, r.logging_style, r.measurement_type,
        not exists (
          select 1 from public.exercises taken
          where taken.created_by = r.owner_id and taken.is_active
            and public.exercise_machine_key(taken.name, taken.gym, taken.grip, taken.attachment, null, taken.load_type, taken.pulley, taken.pulley_position, taken.equipment)
              = public.exercise_machine_key(r.name, r.gym, r.grip, r.attachment, null, r.load_type, r.pulley, r.pulley_position, r.equipment)
        ),
        r.gym, r.feel_notes, r.attachment, r.load_type, r.pulley,
        r.grip, r.pulley_position, r.setup_details, r.equipment
      )
      returning id into v_copy;
    end if;

    update public.workout_exercises
    set exercise_id = v_copy
    where user_id = r.owner_id and exercise_id = r.exercise_id;

    update public.equipment_profiles
    set exercise_id = v_copy
    where created_by = r.owner_id and exercise_id = r.exercise_id;

    update public.workout_split_day_exercises
    set exercise_id = v_copy
    where user_id = r.owner_id and exercise_id = r.exercise_id;

    -- A rep range moves too, unless they already set one on their own copy.
    update public.exercise_progression_settings
    set exercise_id = v_copy
    where user_id = r.owner_id and exercise_id = r.exercise_id
      and not exists (
        select 1 from public.exercise_progression_settings kept
        where kept.user_id = r.owner_id and kept.exercise_id = v_copy
      );
    delete from public.exercise_progression_settings
    where user_id = r.owner_id and exercise_id = r.exercise_id;

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
              and public.exercise_machine_key(r.name, r.gym, r.grip, r.attachment, r.photo_url, r.load_type, r.pulley, r.pulley_position, r.equipment) = public.exercise_machine_key(e.name, e.gym, e.grip, e.attachment, e.photo_url, e.load_type, e.pulley, e.pulley_position, e.equipment)
            order by r.is_active desc, r.created_at
            limit 1),
           e.id
         ) as new_id
  from public.exercises e
  where e.created_by = p_placeholder;

  -- Only workouts move. The rep ranges the trainer set for the tracked client
  -- are theirs, not the client's: they go with the placeholder.
  delete from public.exercise_progression_settings where user_id = p_placeholder;

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

  -- The client's profile is exactly what they made it: nothing the trainer
  -- entered for the tracked client (name, birthday, height, weight) is copied.

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

-- Nothing calls the six-argument key any more.
drop function public.exercise_machine_key(text, text, text, text, text, text);
