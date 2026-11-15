-- Phone numbers, for finding friends from contacts.
--
-- * users.phone_e164 -- the person's phone number in E.164 form (+16045551234), asked for when
--   they sign up (and once of everyone who signed up before it was), changed in Settings >
--   Profile & Personal Information, all through the API. Checked as a real number for its
--   country, never confirmed by text. Only ever the person's own (users_select_own): never on a
--   profile, never shown to anyone else. Not unique -- an unconfirmed number mustn't stop its
--   real owner from using it.
-- * users.findable_by_phone -- whether people with that number in their contacts can find them
--   (Settings > Account & Security), on unless turned off, like findable_by_email.
-- * find_users_by_phone_hashes -- the people whose number is one of these SHA-256 hashes of an
--   E.164 number (worked out on the finder's phone; no number is ever sent), and who let
--   themselves be found that way. API-only, like find_users_by_email_hashes. Nothing sent is kept.

alter table public.users
  add column phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  add column findable_by_phone boolean not null default true;

create function public.find_users_by_phone_hashes(p_hashes text[])
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.findable_by_phone
    and u.phone_e164 is not null
    and encode(sha256(convert_to(u.phone_e164, 'UTF8')), 'hex') = any (p_hashes);
$$;

revoke all on function public.find_users_by_phone_hashes(text[]) from public, anon, authenticated;
grant execute on function public.find_users_by_phone_hashes(text[]) to service_role;
