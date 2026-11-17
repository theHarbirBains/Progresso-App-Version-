-- A trainer's code moves only workouts.
--
-- Claiming a tracked client's history used to bring more than the workouts:
-- it filled any blank in the client's profile (name, birthday, height, weight)
-- from what the trainer entered for the tracked client, and it moved the rep
-- ranges the trainer set. Harbir: only workout data moves -- whatever the
-- person entered signing up stays exactly as they made it. So the claim now
-- moves the workouts (with their exercises, sets and the records rebuilt from
-- them) and keeps the trainer linked, active, as before; the profile and the
-- trainer's rep ranges are left behind with the placeholder, which the API
-- deletes once the claim is done.

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
              and public.exercise_machine_key(r.name, r.gym, r.attachment, r.photo_url, r.load_type, r.pulley) = public.exercise_machine_key(e.name, e.gym, e.attachment, e.photo_url, e.load_type, e.pulley)
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
