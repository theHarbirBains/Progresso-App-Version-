-- Dev switch for trainer mode while the paywall is not built.
--
-- Trainer access is the Trainer entitlement on a subscriptions row, and the
-- database and API both check that row. Run this in the Supabase SQL editor
-- (or with `npx supabase db query --linked -f`). Replace the placeholder id with
-- the auth user id of the account to switch.
--
-- Not a migration: this changes one account's data, so it is never applied to
-- the project automatically. Do not run it against production users.

-- Turn trainer access ON (a year from now).
insert into public.subscriptions (user_id, revenuecat_customer_id, status, entitlement_id, current_period_ends_at)
values ('00000000-0000-0000-0000-000000000000', 'dev-trainer-00000000', 'active', 'trainer', now() + interval '365 days')
on conflict (user_id) do update
set entitlement_id = 'trainer', status = 'active', current_period_ends_at = now() + interval '365 days';

-- Turn trainer access OFF again (the account keeps its data).
-- update public.subscriptions
-- set status = 'expired', current_period_ends_at = now() - interval '1 day'
-- where user_id = '00000000-0000-0000-0000-000000000000' and entitlement_id = 'trainer';
