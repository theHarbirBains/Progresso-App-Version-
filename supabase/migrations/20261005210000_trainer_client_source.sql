-- Where a trainer-client link came from.
--   managed: the trainer created the account (invite sent). The trainer may
--            edit its body measurements, since they entered them.
--   linked:  an existing account the client accepted. The client owns their
--            profile; the trainer can read it but not edit it.
alter table public.trainer_clients
  add column source text not null default 'linked'
  check (source in ('managed', 'linked'));
