-- Default (built-in) food database: adds the columns/indexes needed to
-- search public.foods efficiently, on top of the existing built-in/custom
-- distinction (created_by is null = built-in, same pattern as exercises).

-- Brand is optional -- most generic/whole foods (chicken breast, banana)
-- have none, only branded/packaged items do.
alter table public.foods add column brand text;

-- Partial-match ("contains") search on name/brand needs trigram indexes,
-- not a plain btree, to stay efficient at scale -- pg_trgm is a standard
-- Postgres contrib extension (already available on Supabase), not an
-- external dependency.
create extension if not exists pg_trgm;

create index foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);
create index foods_brand_trgm_idx on public.foods using gin (brand gin_trgm_ops) where brand is not null;

-- Duplicate-safe seeding for built-ins: a built-in food is uniquely
-- identified by its name + brand (two different brands may share a food
-- name, e.g. two "Protein Bar" entries). Mirrors
-- exercises_builtin_name_unique's (lower(name)) where created_by is null
-- pattern, extended with brand since foods (unlike exercises) can be
-- brand-specific.
create unique index foods_builtin_name_brand_unique
on public.foods (lower(name), lower(coalesce(brand, '')))
where created_by is null;
