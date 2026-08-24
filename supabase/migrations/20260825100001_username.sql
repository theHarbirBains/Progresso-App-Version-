-- Unique user handle, separate from display_name (which is just a friendly
-- greeting name and doesn't need to be unique). Optional: no forced
-- onboarding means a user can leave this unset indefinitely.
--
-- Lowercase-only is enforced here as a defense-in-depth backstop; the
-- backend always lowercases before writing, so a plain unique constraint
-- is sufficient for case-insensitive uniqueness (no two distinct-cased
-- values can ever coexist if only lowercase is ever accepted).
alter table public.users add column username text unique;

alter table public.users add constraint users_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');
