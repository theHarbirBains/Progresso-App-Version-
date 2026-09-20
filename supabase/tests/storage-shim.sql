-- Minimal stand-in for what a real Supabase project already provisions
-- before any user migration runs: the storage schema, storage.buckets/
-- storage.objects (with RLS already enabled, exactly as Supabase ships
-- them), and the storage.foldername() helper policies call. Test/dev
-- tooling only -- never applied to a real Supabase project (which already
-- has the real versions of all of this). Mirrors auth-shim.sql's approach
-- for the auth schema.
create schema if not exists storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

-- Same expression Supabase's real storage schema uses: every path segment
-- except the last (the "folder" a given object name lives under), so
-- (storage.foldername(name))[1] is the first path segment -- the
-- convention this app's policies use for a "{user_id}/filename" path.
create function storage.foldername(name text) returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
