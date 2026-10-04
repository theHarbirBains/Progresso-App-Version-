-- New accounts default to pounds. Existing rows keep whatever unit they
-- already have: a stored 'kg' can't be told apart from "never changed it",
-- so nothing is rewritten here.
alter table public.users
  alter column weight_unit set default 'lb';
