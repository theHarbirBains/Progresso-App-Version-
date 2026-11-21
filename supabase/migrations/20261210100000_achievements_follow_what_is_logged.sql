-- Achievements follow what's logged (Harbir's call, replacing "an award is never taken back"): a
-- level earned from the person's own logging -- training, cardio, nutrition -- is taken back once
-- what they've logged no longer reaches it: a workout deleted, a set or a cardio activity
-- corrected, a split or a saved meal removed. Its AP goes with it, so lifetime AP and the rank
-- from it can go down -- someone who logged a set wrong doesn't keep what it earned. Social
-- achievements (friends, likes) stay once earned: they come from other people, not from what the
-- person logged. Nothing else changes: an award is still only ever made or taken back by the
-- server (award_achievements, through award_my_achievements, award_everyone and the API), never
-- edited (achievement_awards_immutable), and levels already reached are untouched.
--
-- Nutrition achievements aren't worked out for a Workouts membership, so nothing earned there is
-- taken back by it either. Earned again later, a level is a new award, with its unlock card.

comment on table public.achievement_awards is
  'The AP ledger: one row per person, achievement and level. Made, and taken back once no longer reached (social ones stay), only by award_achievements; never edited.';

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

  -- What's no longer reached goes first: a level of an achievement worked out from the person's
  -- own logging whose figure has fallen below its goal. Social ones stay; nutrition ones aren't
  -- worked out (or taken back) without Nutrition in the membership.
  delete from public.achievement_awards a
  using public.achievement_levels l, public.achievement_definitions d
  where a.user_id = p_user
    and l.achievement_id = a.achievement_id
    and l.level = a.level
    and d.id = a.achievement_id
    and d.category <> 'social'
    and (d.category <> 'nutrition' or v_nutrition)
    and coalesce((v_metrics ->> d.metric)::numeric, 0) < l.goal;

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
  -- the level it holds.
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
