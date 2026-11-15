-- A person's last name (users.last_name), asked for beside their first name (users.display_name)
-- as they sign up and in Settings > Profile & Personal Information, and shown after it on their
-- profile (apps/api/src/social/people.service.ts). Set through the API, like bio. Optional here:
-- everyone who signed up before it was asked for has none until they add it.

alter table public.users
  add column last_name text check (last_name is null or char_length(last_name) between 1 and 50);
