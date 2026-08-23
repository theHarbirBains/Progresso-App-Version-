-- App-level profile row, 1:1 with auth.users. Holds only what the app needs
-- beyond what Supabase Auth already stores.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Auto-provision a public.users row whenever Supabase Auth creates a user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.users enable row level security;

create policy "users_select_own"
on public.users for select
to authenticated
using (id = auth.uid());

create policy "users_update_own"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- No insert/delete policy for authenticated: rows are created by the
-- handle_new_user trigger and removed via auth.users cascade only.
