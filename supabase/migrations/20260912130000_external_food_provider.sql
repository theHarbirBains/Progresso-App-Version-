-- External food-data provider support: lets public.foods cache real branded
-- grocery products fetched from an external food database (Open Food Facts
-- today -- see apps/api/src/foods/providers/), on top of the existing
-- built-in/custom distinction (created_by is null = built-in/cached-external,
-- same as the generic default foods added earlier).
--
-- provider/provider_food_id together identify exactly one external product,
-- so re-searching the same product never creates a second row -- the
-- backend upserts on this pair (see FoodsService). A row with provider is
-- null is either a hand-seeded generic food (existing 20260912100001 seed)
-- or a future user-created custom food -- neither came from an external
-- provider, so this pair is meaningless for them.
alter table public.foods add column provider text;
alter table public.foods add column provider_food_id text;

-- Barcode/GTIN/UPC, when the provider has one -- kept independent of
-- provider/provider_food_id (a barcode is a real-world product identifier,
-- not a provider-internal one) so a future barcode-scan lookup can query it
-- directly regardless of which provider a given cached row came from.
alter table public.foods add column barcode text;

-- Deliberately NOT a partial index (no "where provider is not null"): a
-- plain unique index already does the right thing here, because SQL
-- treats every NULL as distinct from every other NULL for uniqueness
-- purposes -- the many rows with provider/provider_food_id both null
-- (generic seeded foods, future user-created custom foods) never collide
-- with each other regardless. A partial index would additionally require
-- every upsert's ON CONFLICT clause to repeat the same WHERE predicate for
-- Postgres to infer it as the arbiter constraint -- which the Supabase-js
-- client's `.upsert(..., { onConflict })` option has no way to express -- so
-- the plain index is also what keeps FoodsService's upsert working at all.
create unique index foods_provider_food_unique
on public.foods (provider, provider_food_id);

create index foods_barcode_idx
on public.foods (barcode)
where barcode is not null;
