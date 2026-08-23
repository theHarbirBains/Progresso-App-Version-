-- Food database: built-in (created_by is null) or user-created custom foods.
-- Same built-in/custom/deactivation pattern as exercises, for the same
-- historical-integrity reason: food_logs snapshots its own nutrition values
-- (see below), but food_id itself should still resolve where possible.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete cascade,
  name text not null,
  serving_size numeric(8, 2) not null default 1 check (serving_size > 0),
  serving_unit text not null default 'serving',
  calories numeric(7, 2) not null check (calories >= 0),
  protein_g numeric(6, 2) not null check (protein_g >= 0),
  carbs_g numeric(6, 2) not null check (carbs_g >= 0),
  fat_g numeric(6, 2) not null check (fat_g >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.foods
for each row execute function public.set_updated_at();

create index foods_created_by_idx on public.foods (created_by);

alter table public.foods enable row level security;

create policy "foods_select"
on public.foods for select
to authenticated
using (created_by is null or created_by = auth.uid());

create policy "foods_insert_own"
on public.foods for insert
to authenticated
with check (created_by = auth.uid());

create policy "foods_update_own"
on public.foods for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- No delete policy: deactivate (is_active = false) via update instead.

-- Nutrition snapshot: what was actually logged, computed at log time. If the
-- source food is edited or deactivated later, rows here are unaffected —
-- they do not read through food_id for their nutrition values.
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  food_name_snapshot text not null,
  serving_size numeric(8, 2) not null check (serving_size > 0),
  serving_unit text not null,
  quantity numeric(6, 2) not null default 1 check (quantity > 0),
  calories numeric(7, 2) not null check (calories >= 0),
  protein_g numeric(6, 2) not null check (protein_g >= 0),
  carbs_g numeric(6, 2) not null check (carbs_g >= 0),
  fat_g numeric(6, 2) not null check (fat_g >= 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index food_logs_user_id_idx on public.food_logs (user_id);
create index food_logs_user_logged_at_idx on public.food_logs (user_id, logged_at desc);

alter table public.food_logs enable row level security;

create policy "food_logs_select_own"
on public.food_logs for select
to authenticated
using (user_id = auth.uid());

create policy "food_logs_insert_own"
on public.food_logs for insert
to authenticated
with check (user_id = auth.uid());

create policy "food_logs_update_own"
on public.food_logs for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Unlike workouts/sets, food logs carry no PR-style derived state, so a
-- real delete policy is safe here (no correctness system depends on the
-- deletion being soft).
create policy "food_logs_delete_own"
on public.food_logs for delete
to authenticated
using (user_id = auth.uid());

-- One optional target set per user. All fields nullable: a user may set
-- some, all, or none of calories/protein/carbs/fat.
create table public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  calories integer check (calories > 0),
  protein_g numeric(6, 2) check (protein_g > 0),
  carbs_g numeric(6, 2) check (carbs_g > 0),
  fat_g numeric(6, 2) check (fat_g > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.nutrition_goals
for each row execute function public.set_updated_at();

alter table public.nutrition_goals enable row level security;

create policy "nutrition_goals_select_own"
on public.nutrition_goals for select
to authenticated
using (user_id = auth.uid());

create policy "nutrition_goals_insert_own"
on public.nutrition_goals for insert
to authenticated
with check (user_id = auth.uid());

create policy "nutrition_goals_update_own"
on public.nutrition_goals for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "nutrition_goals_delete_own"
on public.nutrition_goals for delete
to authenticated
using (user_id = auth.uid());
