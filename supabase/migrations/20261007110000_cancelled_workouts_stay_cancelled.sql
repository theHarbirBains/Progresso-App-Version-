-- ---------------------------------------------------------------------------
-- A cancelled workout is never logged
-- ---------------------------------------------------------------------------
-- Cancelling soft-deletes an open workout (deleted_at set, completed_at null). A
-- cancelled workout must never get a completed_at: that would log it everywhere
-- history, stats and the Feed read. The database enforces it, so no code path can
-- complete one by mistake.

create or replace function public.forbid_completing_cancelled_workout()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is not null and old.completed_at is null and new.completed_at is not null then
    raise exception 'a cancelled workout cannot be completed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger workouts_cancelled_stay_cancelled
before update of completed_at on public.workouts
for each row execute function public.forbid_completing_cancelled_workout();
