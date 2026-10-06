-- Whether an invite created the invited account.
--   true:  the email had no account, so the trainer's invite created it. The
--          client is managed, and the trainer may edit the details they entered.
--   false: the email already had an account. That account belongs to its owner,
--          so the link is linked and the trainer cannot edit its profile.
alter table public.trainer_invites
  add column created_account boolean not null default false;
