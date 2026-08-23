create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  performed_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

create index workouts_user_id_idx on public.workouts (user_id);
create index workouts_user_performed_at_idx on public.workouts (user_id, performed_at desc);

alter table public.workouts enable row level security;

create policy "workouts_select_own"
on public.workouts for select
to authenticated
using (user_id = auth.uid());

create policy "workouts_insert_own"
on public.workouts for insert
to authenticated
with check (user_id = auth.uid());

create policy "workouts_update_own"
on public.workouts for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- No delete policy: deletion is soft (deleted_at) via update, so the PR
-- recompute trigger (added later) always sees the change. Hard delete is
-- only available to service-role, e.g. for account-deletion flows.
