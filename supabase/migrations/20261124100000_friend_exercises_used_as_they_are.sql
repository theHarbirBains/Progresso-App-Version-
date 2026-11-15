-- A friend's exercise, used as it is.
--
-- Until now, using an exercise shared by someone you follow (the Exercise
-- Library's Friends tab) first copied it into your own library, so its
-- creator's later changes never reached you. Now it's used as it is -- there's
-- no copy: the workout, split day or rep range points at their exercise. Only
-- its creator changes it, and when they do -- its name, photo, gym, grip,
-- weight type or pulley -- it changes for everyone who uses it. Your sets,
-- records and top sets stay yours: they're keyed to you, never to whose
-- exercise it is. (Copies made before this stay their owners' own.)
--
-- * user_can_use_exercise -- an exercise a person can use: a built-in one,
--   their own, one by someone they follow (an accepted follow, and neither has
--   blocked the other), or one they've already logged or planned (so their
--   history keeps its names after an unfollow).
-- * exercises_used_select -- such an exercise can be read; and a trainer reads
--   the exercises their active clients log.
-- * A split day or a rep range takes such an exercise too.
-- * delete_user_data -- deleting an account moves everyone who uses one of its
--   exercises, in a workout, a split day or a rep range, onto a copy of their
--   own, as it already did for workouts.

create function public.user_can_use_exercise(p_user uuid, p_exercise uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exercises e
    where e.id = p_exercise
      and (
        e.created_by is null
        or e.created_by = p_user
        or (
          exists (
            select 1 from public.follows f
            where f.follower_id = p_user and f.followee_id = e.created_by and f.status = 'accepted'
          )
          and not public.is_blocked_between(p_user, e.created_by)
        )
        or exists (
          select 1 from public.workout_exercises we
          where we.user_id = p_user and we.exercise_id = e.id
        )
        or exists (
          select 1 from public.workout_split_day_exercises sde
          where sde.user_id = p_user and sde.exercise_id = e.id
        )
      )
  );
$$;

revoke all on function public.user_can_use_exercise(uuid, uuid) from public, anon, authenticated;

-- The signed-in person's own question, for the policy below -- never someone else's.
create function public.can_use_exercise(p_exercise uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_use_exercise(auth.uid(), p_exercise)
    or exists (
      select 1 from public.workout_exercises we
      where we.exercise_id = p_exercise and public.is_active_trainer_for(we.user_id)
    );
$$;

revoke all on function public.can_use_exercise(uuid) from public, anon;
grant execute on function public.can_use_exercise(uuid) to authenticated;

create policy "exercises_used_select"
on public.exercises for select
to authenticated
using (
  created_by is not null
  and created_by <> auth.uid()
  and public.can_use_exercise(id)
);

create or replace function public.trg_exercise_progression_settings_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_can_use_exercise(new.user_id, new.exercise_id) then
    raise exception 'exercise not available' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.trg_set_split_day_exercise_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select d.user_id into new.user_id
  from public.workout_split_days d
  where d.id = new.workout_split_day_id;

  if new.user_id is null then
    raise exception 'workout split day % does not exist', new.workout_split_day_id;
  end if;

  if not public.user_can_use_exercise(new.user_id, new.exercise_id) then
    raise exception 'exercise not available' using errcode = '42501';
  end if;

  return new;
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
      and public.exercise_machine_key(x.name, x.gym, x.attachment, x.photo_url, x.load_type, x.pulley) = public.exercise_machine_key(r.name, r.gym, r.attachment, r.photo_url, r.load_type, r.pulley)
      and x.measurement_type = r.measurement_type
    limit 1;

    if v_copy is null then
      insert into public.exercises (
        created_by, name, muscle_group, movement_type, logging_style, measurement_type, is_active,
        gym, feel_notes, attachment, load_type, pulley
      )
      values (
        r.owner_id, r.name, r.muscle_group, r.movement_type, r.logging_style, r.measurement_type,
        not exists (
          select 1 from public.exercises taken
          where taken.created_by = r.owner_id and taken.is_active
            and public.exercise_machine_key(taken.name, taken.gym, taken.attachment, null, taken.load_type, taken.pulley)
              = public.exercise_machine_key(r.name, r.gym, r.attachment, null, r.load_type, r.pulley)
        ),
        r.gym, r.feel_notes, r.attachment, r.load_type, r.pulley
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
