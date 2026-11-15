-- Achievements for everyone, whether or not they've opened the app since.
--
-- Until now a person's achievements were awarded only when their own app asked
-- (award_my_achievements), so someone who hadn't opened a build with achievements -- a friend
-- on an older build -- showed no rank and nothing earned, however much they'd trained. Now:
--
-- * award_everyone -- runs award_achievements for every account (never a tracked client's
--   placeholder, which has no one behind it and moves onto the client's own account when
--   claimed), in each person's own time zone, or UTC until their phone has said. Run once here
--   for everyone, then nightly.
-- * users.achievements_seen_at -- the latest award the person has been shown, so an award made
--   while they were away (overnight, as a friend opens their profile, as they claim a tracked
--   history) still gets its unlock the next time they open the app. mark_achievements_seen is
--   their own way to move it forward.
--
-- Nothing is ever taken away: award_achievements only adds what's been reached.

alter table public.users add column achievements_seen_at timestamptz;

create function public.mark_achievements_seen(p_until timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your achievements';
  end if;
  -- Only ever forward, and never past now.
  update public.users
  set achievements_seen_at = greatest(coalesce(achievements_seen_at, '-infinity'), least(p_until, now()))
  where id = auth.uid();
end;
$$;

revoke all on function public.mark_achievements_seen(timestamptz) from public, anon;
grant execute on function public.mark_achievements_seen(timestamptz) to authenticated;

create function public.award_everyone()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_person record;
  v_people integer := 0;
begin
  for v_person in
    select u.id, u.time_zone
    from public.users u
    where not exists (
      select 1 from public.trainer_placeholder_clients p
      where p.placeholder_user_id = u.id and p.claimed_at is null
    )
  loop
    perform public.award_achievements(v_person.id, coalesce(v_person.time_zone, 'UTC'));
    v_people := v_people + 1;
  end loop;
  return v_people;
end;
$$;

revoke all on function public.award_everyone() from public, anon, authenticated;
grant execute on function public.award_everyone() to service_role;

-- Everyone, now.
select public.award_everyone();

-- And nightly, where pg_cron is available (Supabase has it; the local test database doesn't,
-- and calls the function directly).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'award-everyone-achievements',
      '45 4 * * *',
      'select public.award_everyone()'
    );
  end if;
end;
$$;
