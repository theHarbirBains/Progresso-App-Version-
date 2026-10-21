-- Phases were removed from the app: nothing reads or writes training_phases any more. Approved
-- by the product owner to drop, with every phase saved in it. Its indexes, policy and triggers go
-- with the table; the overlap-check function is dropped after it.

drop table if exists public.training_phases;
drop function if exists public.trg_training_phases_no_overlap();
