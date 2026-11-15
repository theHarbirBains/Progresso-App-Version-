-- Nutrition achievements come only with Nutrition in the membership (Workouts + Nutrition or
-- Everything). Without it, food can't be logged in the app -- but someone who logged food and
-- then switched to Workouts still has those logs, and until now would still have been awarded
-- nutrition levels from them. Now award_achievements skips nutrition achievements for a
-- Workouts membership, so they can't be earned or add to the rank, as the Achievements page says.
-- Levels already awarded stay: AP never goes down. Their progress is still kept, so switching
-- back picks up where it was.

create or replace function public.award_achievements(p_user uuid, p_zone text)
returns table (achievement_id text, level smallint, ap integer, awarded_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_zone text := public.achievement_zone(p_zone);
  v_metrics jsonb;
  -- Nutrition achievements come only with Nutrition in the membership.
  v_nutrition boolean := coalesce(
    (select u.membership_tier from public.users u where u.id = p_user),
    'everything'
  ) <> 'workouts';
begin
  -- Two runs for the same person at once take turns; the unique key does the rest.
  perform pg_advisory_xact_lock(hashtextextended('achievements:' || p_user::text, 0));

  v_metrics := public.achievement_metrics(p_user, v_zone);

  -- What this run newly awards is what it returns.
  return query
  with inserted as (
    insert into public.achievement_awards (user_id, achievement_id, level, ap)
    select p_user, l.achievement_id, l.level, l.ap
    from public.achievement_levels l
    join public.achievement_definitions d on d.id = l.achievement_id
    where coalesce((v_metrics ->> d.metric)::numeric, 0) >= l.goal
      and (d.category <> 'nutrition' or v_nutrition)
    on conflict on constraint achievement_awards_user_id_achievement_id_level_key do nothing
    returning achievement_awards.achievement_id, achievement_awards.level,
      achievement_awards.ap, achievement_awards.awarded_at
  )
  select i.achievement_id, i.level, i.ap, i.awarded_at from inserted i;

  -- Then where each stands (a later statement, so it sees those awards): the figure now, and
  -- the level reached -- never below one awarded.
  insert into public.achievement_progress (user_id, achievement_id, value, level, updated_at)
  select p_user, d.id, coalesce((v_metrics ->> d.metric)::numeric, 0),
    coalesce((
      select max(a.level) from public.achievement_awards a
      where a.user_id = p_user and a.achievement_id = d.id
    ), 0),
    now()
  from public.achievement_definitions d
  on conflict on constraint achievement_progress_pkey do update
    set value = excluded.value, level = excluded.level, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.award_achievements(uuid, text) from public, anon, authenticated;
grant execute on function public.award_achievements(uuid, text) to service_role;
