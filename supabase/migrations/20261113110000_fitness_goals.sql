-- Several fitness goals, up to three, in place of one.
--
-- fitness_goals holds the goals a person picked, in the order picked.
-- fitness_goal stays, as the first of them, for app versions that still read or
-- send just one: a trigger keeps the two in step whichever one a write sets.

alter table public.users
  add column fitness_goals text[] not null default '{}';

update public.users
set fitness_goals = array[fitness_goal]
where fitness_goal is not null;

alter table public.users add constraint users_fitness_goals_check
  check (
    cardinality(fitness_goals) <= 3
    and fitness_goals <@ array[
      'build_muscle', 'get_stronger', 'lose_fat', 'improve_fitness',
      'improve_athletic_performance', 'maintain_fitness', 'general_health', 'other'
    ]::text[]
  );

create function public.trg_users_sync_fitness_goals()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(new.fitness_goals) > 0 then
      new.fitness_goal := new.fitness_goals[1];
    elsif new.fitness_goal is not null then
      new.fitness_goals := array[new.fitness_goal];
    end if;
  elsif new.fitness_goals is distinct from old.fitness_goals then
    new.fitness_goal := new.fitness_goals[1];
  elsif new.fitness_goal is distinct from old.fitness_goal then
    new.fitness_goals := case
      when new.fitness_goal is null then '{}'::text[]
      else array[new.fitness_goal]
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_users_sync_fitness_goals() from public, anon, authenticated;

create trigger users_sync_fitness_goals
before insert or update of fitness_goal, fitness_goals on public.users
for each row execute function public.trg_users_sync_fitness_goals();
