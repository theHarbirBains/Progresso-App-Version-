-- A person's profile, as others see it (apps/api/src/social/people.service.ts):
--
-- * users.bio -- a short line about themselves, shown under their name to anyone
--   who opens their profile, like their name and photo. Optional; set in
--   Settings > Profile & Personal Information through the API.
-- * person_profile_totals -- the figures on their profile for the people whose
--   follow they accepted (and themselves): everything they've lifted, how many
--   records they hold, and their busiest month. Only from the workouts their
--   followers can see (finished, not deleted, not logged by a trainer) unless
--   it's their own. API-only, like person_best_lifts.

alter table public.users
  add column bio text check (bio is null or char_length(bio) between 1 and 80);

create function public.person_profile_totals(p_owner uuid, p_include_trainer_logged boolean)
returns table (total_volume_kg numeric, pr_count integer, best_month_workouts integer)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select w.id, w.performed_at
    from public.workouts w
    where w.user_id = p_owner
      and w.completed_at is not null
      and w.deleted_at is null
      and (p_include_trainer_logged or w.logged_by is null)
  )
  select
    coalesce((
      select sum(s.weight_kg * s.reps)
      from visible v
      join public.workout_exercises we on we.workout_id = v.id and we.deleted_at is null
      join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
      where we.measurement_type = 'weight_reps'
        and s.completed_at is not null
        and s.weight_kg is not null
        and s.reps is not null
        and s.reps > 0
    ), 0) as total_volume_kg,
    (
      -- Every rep-count PR and true 1RM they hold now, from a workout that counts.
      select count(*)::integer
      from (
        select r.source_set_id from public.rep_prs r where r.user_id = p_owner
        union all
        select o.source_set_id from public.one_rep_maxes o where o.user_id = p_owner
      ) records
      join public.sets s on s.id = records.source_set_id
      join public.workout_exercises we on we.id = s.workout_exercise_id
      join visible v on v.id = we.workout_id
    ) as pr_count,
    coalesce((
      select max(months.n)::integer
      from (
        select count(*) as n
        from visible v
        group by date_trunc('month', v.performed_at)
      ) months
    ), 0) as best_month_workouts;
$$;

revoke all on function public.person_profile_totals(uuid, boolean) from public, anon, authenticated;
grant execute on function public.person_profile_totals(uuid, boolean) to service_role;
