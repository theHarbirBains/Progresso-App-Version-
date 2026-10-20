-- ---------------------------------------------------------------------------
-- Nutrition shortcuts: the amount as typed, saved meals and recipes
-- ---------------------------------------------------------------------------

-- 1. A log keeps the amount the way it was typed -- "2 cookies", "150 g",
-- "330 ml" -- beside the servings it came to (quantity, still what the totals
-- are worked out from), and the serving's own wording ("3 cookies (34 g)") so
-- the pieces can be counted again when it's edited. Older logs have neither
-- and keep showing servings.
alter table public.food_logs
  add column entered_amount numeric(8, 2) check (entered_amount is null or entered_amount > 0),
  add column entered_unit text
    check (entered_unit is null or entered_unit in ('servings', 'pieces', 'g', 'oz', 'ml')),
  add column serving_label text check (serving_label is null or char_length(serving_label) <= 80),
  add constraint food_logs_entered_together check ((entered_amount is null) = (entered_unit is null));

-- 2. Saved meals: foods eaten together, each with its amount, logged in one go.
-- Logging one logs each food as its own entry, at the food's figures then,
-- like any other log.
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.saved_meals
for each row execute function public.set_updated_at();

create index saved_meals_user_idx on public.saved_meals (user_id);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  -- Always the meal's owner (set by trigger), so RLS can be own-row.
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  position smallint not null default 0,
  -- Servings, and the amount as typed.
  quantity numeric(6, 2) not null check (quantity > 0),
  entered_amount numeric(8, 2) check (entered_amount is null or entered_amount > 0),
  entered_unit text
    check (entered_unit is null or entered_unit in ('servings', 'pieces', 'g', 'oz', 'ml')),
  created_at timestamptz not null default now(),
  check ((entered_amount is null) = (entered_unit is null))
);

create index saved_meal_items_meal_idx on public.saved_meal_items (saved_meal_id);

-- 3. Recipes: a drink or a meal always made the same way, logged as one food.
-- A recipe IS a food (the person's own), whose figures per serving come from
-- its ingredients and how many servings the batch makes. Editing it changes
-- what's logged from then on; logs already made keep their own figures.
alter table public.foods
  add column recipe_servings numeric(6, 2) check (recipe_servings is null or recipe_servings > 0);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.foods (id) on delete cascade,
  -- Always the recipe's owner (set by trigger), so RLS can be own-row.
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  position smallint not null default 0,
  quantity numeric(6, 2) not null check (quantity > 0),
  entered_amount numeric(8, 2) check (entered_amount is null or entered_amount > 0),
  entered_unit text
    check (entered_unit is null or entered_unit in ('servings', 'pieces', 'g', 'oz', 'ml')),
  created_at timestamptz not null default now(),
  check ((entered_amount is null) = (entered_unit is null)),
  check (food_id <> recipe_id)
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- An item or ingredient belongs to whoever owns its meal or recipe, and can
-- only be a food they can see: their own, or the shared catalog.
create function public.trg_saved_meal_items_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.saved_meals where id = new.saved_meal_id;
  if v_owner is null then
    raise exception 'saved meal not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.foods f
    where f.id = new.food_id and (f.created_by is null or f.created_by = v_owner)
  ) then
    raise exception 'food not available' using errcode = '42501';
  end if;
  new.user_id := v_owner;
  return new;
end;
$$;

revoke all on function public.trg_saved_meal_items_owner() from public, anon, authenticated;

create trigger saved_meal_items_owner
before insert or update on public.saved_meal_items
for each row execute function public.trg_saved_meal_items_owner();

create function public.trg_recipe_ingredients_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select created_by into v_owner
  from public.foods
  where id = new.recipe_id and recipe_servings is not null;
  if v_owner is null then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.foods f
    where f.id = new.food_id and (f.created_by is null or f.created_by = v_owner)
  ) then
    raise exception 'food not available' using errcode = '42501';
  end if;
  new.user_id := v_owner;
  return new;
end;
$$;

revoke all on function public.trg_recipe_ingredients_owner() from public, anon, authenticated;

create trigger recipe_ingredients_owner
before insert or update on public.recipe_ingredients
for each row execute function public.trg_recipe_ingredients_owner();

-- Own rows only, like food_logs.
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "saved_meals_own" on public.saved_meals for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "saved_meal_items_own" on public.saved_meal_items for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "recipe_ingredients_own" on public.recipe_ingredients for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
