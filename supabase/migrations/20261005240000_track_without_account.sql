-- Clients a trainer tracks before they have a Progresso account.
--
-- The trainer adds a client with no email. The API creates a placeholder auth
-- account for them (no email they can use, no way to sign in), so every row a
-- trainer logs is still owned by a user_id and the isolation and PR rules are
-- unchanged. The trainer gets a one-time claim code. When the client enters it,
-- claim_placeholder_history moves everything onto the client's own account.

create table public.trainer_placeholder_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  -- No foreign key: the placeholder account is deleted once its history moves,
  -- and this row keeps the record of that claim.
  placeholder_user_id uuid not null unique,
  -- SHA-256 of the normalised code. The code itself is never stored.
  code_hash text not null,
  code_expires_at timestamptz not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  claimed_by uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.trainer_placeholder_clients
for each row execute function public.set_updated_at();

-- A live code identifies one placeholder, and a trainer may only have one live
-- code per placeholder (the placeholder is unique above).
create unique index trainer_placeholder_clients_live_code_idx
on public.trainer_placeholder_clients (code_hash)
where claimed_at is null;

alter table public.trainer_placeholder_clients enable row level security;

create policy "trainer_placeholder_clients_select_trainer"
on public.trainer_placeholder_clients for select
to authenticated
using (trainer_id = auth.uid());

revoke insert, update, delete on public.trainer_placeholder_clients from anon, authenticated;

-- Moves a placeholder's history onto a real account, in one transaction.
-- Called by the API (service role) only after it has checked the claim code.
-- Returns the number of workouts moved.
create function public.claim_placeholder_history(p_placeholder uuid, p_client uuid)
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

  -- The trainer's link moves to the client. It starts pending: the client keeps
  -- the trainer by accepting, and it is now linked, not managed.
  delete from public.trainer_clients tc
  where tc.client_id = p_placeholder
    and exists (
      select 1 from public.trainer_clients existing
      where existing.trainer_id = tc.trainer_id and existing.client_id = p_client
    );

  update public.trainer_clients
  set client_id = p_client, status = 'pending', source = 'linked', ended_at = null
  where client_id = p_placeholder;

  update public.trainer_placeholder_clients
  set claimed_by = p_client, claimed_at = now()
  where id = v_row.id;

  return v_moved;
end;
$$;

revoke all on function public.claim_placeholder_history(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_placeholder_history(uuid, uuid) to service_role;
