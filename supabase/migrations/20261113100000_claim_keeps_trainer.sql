-- Claiming a tracked client's history keeps their trainer.
--
-- A client who enters their trainer's claim code is saying yes to that
-- trainer, so the link moves onto their account active (it used to wait,
-- pending, for them to accept) and the trainer goes on seeing the workouts and
-- records they logged. The rep ranges and weight steps the trainer set for an
-- exercise move with it too. Everything else is as before.

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
            where r.created_by = p_client and lower(r.name) = lower(e.name)
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

revoke all on function public.claim_placeholder_history(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_placeholder_history(uuid, uuid) to service_role;
