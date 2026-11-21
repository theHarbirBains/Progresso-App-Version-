-- One-off data fix (Harbir's call): a finished group workout keeps only the exercises its owner
-- did. An exercise added in a group is added to everyone's workout, so someone who did their own
-- variation instead was left with it empty on their finished workout. From now on finishing a
-- group takes such an exercise off (GroupsService.finish); this does the same for every group
-- workout finished before it.
--
-- An exercise with no finished set on it is soft-deleted, exactly as Remove does: its row, and
-- any empty sets under it, stay, all marked with this run's one timestamp, so it can be put back
-- by clearing deleted_at. Records, top sets, volume and achievements are untouched -- nothing on
-- these exercises ever counted. Running it again changes nothing.

update public.workout_exercises we
set deleted_at = now()
from public.workouts w
where w.id = we.workout_id
  and w.group_id is not null
  and w.completed_at is not null
  and w.deleted_at is null
  and we.deleted_at is null
  and not exists (
    select 1
    from public.sets s
    where s.workout_exercise_id = we.id
      and s.completed_at is not null
      and s.deleted_at is null
  );
