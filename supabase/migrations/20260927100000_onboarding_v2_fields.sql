-- Onboarding restructure: account creation now happens AFTER onboarding
-- (the whole flow runs pre-auth, answers held in a local draft, submitted
-- in one batch the moment the account is created), plus three new fields
-- the redesigned flow collects. All nullable, same "null = not answered"
-- convention as the original onboarding_profile_fields migration.
alter table public.users
  add column referral_source text,
  add column country text,
  add column average_workout_length text;

alter table public.users add constraint users_referral_source_check
  check (referral_source is null or referral_source in (
    'tiktok', 'instagram', 'friend', 'app_store', 'google_search', 'creator', 'other'
  ));

-- ISO 3166-1 alpha-2 (e.g. 'US', 'CA') -- purely informational today, no
-- feature reads it yet, so no FK/lookup table.
alter table public.users add constraint users_country_check
  check (country is null or country ~ '^[A-Z]{2}$');

alter table public.users add constraint users_average_workout_length_check
  check (average_workout_length is null or average_workout_length in (
    '20_30', '30_45', '45_60', '60_plus'
  ));
