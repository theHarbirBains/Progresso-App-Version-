-- Training preferences, for recommending workout programs (apps/mobile/src/programs/recommendations.ts).
--
-- training_priorities: what someone wants to prioritize in the gym -- up to three areas, in the
--   order picked, or Balanced Development on its own. Priorities, not the only muscles trained.
-- equipment_access: where they train -- a full gym, dumbbells only, or bodyweight only.
-- training_exclusions: what they'd rather not train directly (chest, glutes).
--
-- Asked in onboarding and changeable in Settings > Workout Preferences; each may be left
-- unanswered (empty, or null). They only decide which programs are recommended -- nothing is
-- hidden or locked by them. Own-row, like the rest of the profile: read under the users select
-- policy, written through PATCH /users/me.

alter table public.users
  add column training_priorities text[] not null default '{}',
  add column equipment_access text,
  add column training_exclusions text[] not null default '{}';

alter table public.users add constraint users_training_priorities_check
  check (
    cardinality(training_priorities) <= 3
    and training_priorities <@ array[
      'balanced', 'chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'
    ]::text[]
    -- Balanced Development is an answer of its own.
    and (not ('balanced' = any (training_priorities)) or cardinality(training_priorities) = 1)
  );

alter table public.users add constraint users_equipment_access_check
  check (equipment_access is null or equipment_access in ('full_gym', 'dumbbells', 'bodyweight'));

alter table public.users add constraint users_training_exclusions_check
  check (training_exclusions <@ array['chest', 'glutes']::text[]);

-- Nobody prioritizes what they'd rather not train.
alter table public.users add constraint users_training_preferences_agree_check
  check (not (training_priorities && training_exclusions));
