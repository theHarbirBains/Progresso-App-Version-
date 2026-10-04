-- Moves every existing account to pounds, per product decision. The previous
-- unit can't be recovered from users.weight_unit once it's overwritten, so
-- snapshot it first. The backup table is safe to drop once the change is
-- confirmed; nothing reads it.
create table if not exists public.users_weight_unit_backup_20261004 as
select id, weight_unit from public.users;

-- Exposed through the Supabase API like every public table, so lock it down:
-- RLS on with no policies means only the service role can read it.
alter table public.users_weight_unit_backup_20261004 enable row level security;

update public.users
set weight_unit = 'lb'
where weight_unit <> 'lb';
