-- Every change a trainer makes to a client's workouts is recorded.
--
-- Trainer mode's RLS (20261005200000_trainer_mode.sql) lets an active trainer
-- insert and update any of a client's workouts, workout exercises and sets,
-- and the app writes those rows directly -- live-session sets, and editing a
-- client's workout. Only the API's own actions (start / finish / cancel a live
-- session, logging a past workout, links) reached trainer_actions, and
-- logged_by is frozen on update, so a trainer editing a set the client logged
-- left no trace at all.
--
-- Trainers keep exactly the access they have; this adds the record. An AFTER
-- trigger on each of the three tables appends one trainer_actions row for each
-- trainer write that changes something a person would call a change: the
-- action (e.g. 'set.edited', 'workout.deleted'), the row, its workout, and
-- each changed field's before and after. A client's own writes, other group
-- members' writes and the API's service-role writes (which record themselves)
-- are left alone.
create function public.trg_record_trainer_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_owner uuid := (v_new ->> 'user_id')::uuid;
  v_columns text[];
  v_column text;
  v_noun text;
  v_verb text;
  v_workout_id uuid;
  v_details jsonb;
  v_changes jsonb := '{}'::jsonb;
begin
  -- Only a trainer writing a client's rows through the client API.
  if auth.role() is distinct from 'authenticated'
     or auth.uid() is null
     or auth.uid() = v_owner
     or not public.is_active_trainer_for(v_owner) then
    return null;
  end if;

  -- The fields a change is described by; bookkeeping columns (updated_at,
  -- logged_by, user_id) never count as one.
  if tg_table_name = 'workouts' then
    v_noun := 'workout';
    v_columns := array['name', 'performed_at', 'completed_at', 'deleted_at', 'workout_split_day_id'];
    v_workout_id := (v_new ->> 'id')::uuid;
  elsif tg_table_name = 'workout_exercises' then
    v_noun := 'exercise';
    v_columns := array['exercise_id', 'order_index', 'deleted_at'];
    v_workout_id := (v_new ->> 'workout_id')::uuid;
  else
    v_noun := 'set';
    v_columns := array['set_index', 'side', 'weight_kg', 'reps', 'completed_at', 'deleted_at'];
    select we.workout_id into v_workout_id
    from public.workout_exercises we
    where we.id = (v_new ->> 'workout_exercise_id')::uuid;
  end if;

  if tg_op = 'INSERT' then
    v_verb := case when v_noun = 'workout' then 'created' else 'added' end;
    foreach v_column in array v_columns loop
      if v_new ? v_column and jsonb_typeof(v_new -> v_column) <> 'null' then
        v_changes := v_changes || jsonb_build_object(v_column, v_new -> v_column);
      end if;
    end loop;
    v_details := jsonb_build_object('workout_id', v_workout_id, 'values', v_changes);
  else
    v_old := to_jsonb(old);
    foreach v_column in array v_columns loop
      if (v_old -> v_column) is distinct from (v_new -> v_column) then
        v_changes := v_changes || jsonb_build_object(
          v_column,
          jsonb_build_object('from', v_old -> v_column, 'to', v_new -> v_column)
        );
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
    if (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
      v_verb := case when v_noun = 'workout' then 'deleted' else 'removed' end;
    elsif (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
      v_verb := 'restored';
    else
      v_verb := 'edited';
    end if;
    v_details := jsonb_build_object('workout_id', v_workout_id, 'changes', v_changes);
  end if;

  insert into public.trainer_actions (trainer_id, client_id, action, target_table, target_id, details)
  values (auth.uid(), v_owner, v_noun || '.' || v_verb, tg_table_name, (v_new ->> 'id')::uuid, v_details);

  return null;
end;
$$;

revoke all on function public.trg_record_trainer_write() from public, anon, authenticated;

create trigger workouts_record_trainer_write
after insert or update on public.workouts
for each row execute function public.trg_record_trainer_write();

create trigger workout_exercises_record_trainer_write
after insert or update on public.workout_exercises
for each row execute function public.trg_record_trainer_write();

create trigger sets_record_trainer_write
after insert or update on public.sets
for each row execute function public.trg_record_trainer_write();
