-- Nutrition provenance and USDA FoodData Central reference data.
--
-- Every nutrition result should answer: where did it come from, was it verified
-- or calculated, what food was matched, which data version, and what assumptions
-- were made. That's stored on the library food and copied onto each log (logs
-- keep their figures as they were at logging time, per CLAUDE.md's snapshot rule).
--
-- USDA FoodData Central data are public domain (CC0). Attribution is stored per
-- result, and USDA's own wording is used. No licence rights beyond that are claimed.

-- 1. Provenance on library foods.
alter table public.foods
  add column nutrition_confidence text
    check (nutrition_confidence in ('verified', 'calculated', 'ai_estimate', 'user_entered')),
  add column nutrition_source_kind text
    check (nutrition_source_kind in (
      'progresso_catalog', 'open_food_facts', 'usda_fdc', 'canadian_nutrient_file',
      'chain_curated', 'user_entered', 'ai_estimate'
    )),
  add column nutrition_source_id text,
  add column nutrition_matched_name text,
  add column nutrition_data_version text,
  add column nutrition_retrieved_at timestamptz,
  add column nutrition_licence text
    check (nutrition_licence in ('public_domain', 'open_government', 'odbl', 'live_only', 'none')),
  add column nutrition_attribution text,
  add column nutrition_assumptions text[] not null default '{}',
  -- A food built from several components (a meal): each component's own provenance.
  add column nutrition_components jsonb;

-- Backfill only what is known. Nothing is guessed.
update public.foods set
  nutrition_confidence = 'verified',
  nutrition_source_kind = 'open_food_facts',
  nutrition_source_id = provider_food_id,
  nutrition_licence = 'odbl',
  nutrition_attribution = 'Open Food Facts contributors (ODbL)'
where provider = 'open_food_facts';

update public.foods set
  nutrition_confidence = 'user_entered',
  nutrition_source_kind = 'user_entered',
  nutrition_licence = 'none'
where created_by is not null and provider is null;

-- Seeded catalog rows (created_by and provider both null) are deliberately left
-- unbackfilled. Their original source isn't recorded, and they must not be
-- claimed as USDA-verified. They resolve as the Progresso catalog, with that
-- caveat shown as an assumption.

-- 2. The same provenance on each log.
alter table public.food_logs
  add column nutrition_confidence text
    check (nutrition_confidence in ('verified', 'calculated', 'ai_estimate', 'user_entered')),
  add column nutrition_source_kind text
    check (nutrition_source_kind in (
      'progresso_catalog', 'open_food_facts', 'usda_fdc', 'canadian_nutrient_file',
      'chain_curated', 'user_entered', 'ai_estimate'
    )),
  add column nutrition_source_id text,
  add column nutrition_matched_name text,
  add column nutrition_data_version text,
  add column nutrition_retrieved_at timestamptz,
  add column nutrition_licence text
    check (nutrition_licence in ('public_domain', 'open_government', 'odbl', 'live_only', 'none')),
  add column nutrition_attribution text,
  add column nutrition_assumptions text[] not null default '{}',
  add column nutrition_components jsonb;

-- 3. USDA FoodData Central reference foods. Read by every signed-in user; written
--    only by the importer through the service role. The data_type list covers the
--    full FoodData Central ecosystem so Branded and FNDDS can be added without a
--    schema change, even though only Foundation and SR Legacy are imported now.
create table public.usda_food_reference (
  fdc_id integer primary key,
  description text not null,
  data_type text not null check (data_type in ('Foundation', 'SR Legacy', 'Branded', 'FNDDS')),
  brand_owner text,
  gtin_upc text,
  calories_per_100g numeric(7, 2) not null check (calories_per_100g >= 0),
  protein_g_per_100g numeric(6, 2) not null check (protein_g_per_100g >= 0),
  carbs_g_per_100g numeric(6, 2) not null check (carbs_g_per_100g >= 0),
  fat_g_per_100g numeric(6, 2) not null check (fat_g_per_100g >= 0),
  data_version text not null,
  imported_at timestamptz not null default now()
);

create index usda_food_reference_gtin_idx on public.usda_food_reference (gtin_upc);
create index usda_food_reference_description_idx
  on public.usda_food_reference (lower(description));

-- Household measures per food ("1 cup" of baked potato = 122 g). Per food, so
-- volume and count amounts convert exactly without a generic density table.
create table public.usda_food_measure (
  fdc_id integer not null references public.usda_food_reference (fdc_id) on delete cascade,
  seq integer not null,
  unit text not null,
  amount numeric(8, 3) not null check (amount > 0),
  grams numeric(8, 2) not null check (grams > 0),
  primary key (fdc_id, seq)
);

alter table public.usda_food_reference enable row level security;
alter table public.usda_food_measure enable row level security;

create policy usda_food_reference_select on public.usda_food_reference
  for select to authenticated using (true);
create policy usda_food_measure_select on public.usda_food_measure
  for select to authenticated using (true);
-- No insert, update or delete policies. Only the service role (the importer) writes.

-- 4. Import audit: which release was loaded, when, and how many rows, so any
--    figure traces back to one dataset.
create table public.nutrition_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  data_version text not null,
  licence text not null,
  row_count integer not null check (row_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);

alter table public.nutrition_import_runs enable row level security;
-- No policies: internal audit, read through the service role only.
